"""
InjectionDefenseService — centralised prompt injection defence.

Call `InjectionDefenseService.defend(text)` on any user-supplied string
before it touches an LLM.  Raises ``InjectionDetectedError`` on the first
violation detected; returns normally if the text is clean.  Callers are
responsible for translating the error into their transport layer's format.

Layers (in order):
  1. Encoding attacks  — base64 / hex payloads that hide keywords
  2. Invisible Unicode — zero-width / BOM characters used for smuggling
  3. Direct patterns   — regex scan for known injection phrases
  4. Typoglycemia      — scrambled-word attacks (e.g. "ingorge" → "ignore")
"""

import base64
import binascii
import re
from collections import Counter


class InjectionDetectedError(Exception):
    """Raised when a prompt injection attempt is detected in user-supplied text."""
    pass


# Keywords that are unambiguously adversarial — safe to check in encoded
# payloads, because they would never appear legitimately in a base64/hex blob.
_ENCODED_KEYWORDS: list[str] = [
    "ignore",
    "system",
    "prompt",
    "instructions",
    "bypass",
    "override",
    "jailbreak",
    "disregard",
]

# Keywords used for typoglycemia detection.
# Deliberately excludes common professional vocabulary that can be
# accidentally flagged as a scrambled injection term:
#   ✗ "system"      — appears constantly in tech CVs ("system design")
#   ✗ "mode"        — too short; high collision risk
#   ✗ "developer"   — ubiquitous in software CVs
#   ✗ "reveal"      — legitimate English word
#   ✗ "previous"    — legitimate English word
#   ✗ "forget"      — legitimate English word
# Only keep terms that are rare in professional prose AND clearly adversarial
# when they appear scrambled.
_TYPOGLYCEMIA_TERMS: frozenset[str] = frozenset(
    [
        "ignore",
        "disregard",
        "bypass",
        "override",
        "jailbreak",
        "instructions",
    ]
)

# Direct injection regex patterns — case-insensitive.
_INJECTION_PATTERNS: list[str] = [
    # Verb + up to 3 filler words + target noun
    # e.g. "ignore all previous prior instructions", "forget the above context"
    r"ignore\s+(\w+\s+){0,3}(instructions?|prompts?|rules?|directives?)",
    r"forget\s+(\w+\s+){0,3}(instructions?|prompts?|rules?|context)",
    r"disregard\s+(\w+\s+){0,3}(instructions?|prompts?|rules?)",
    r"override\s+(\w+\s+){0,3}(instructions?|rules?)",
    r"bypass\s+(\w+\s+){0,3}(measures?|controls?|restrictions?|safeguards?)",
    # Reference to "the above"
    r"(ignore|disregard|forget)\s+the\s+above",
    # Identity / persona attacks
    r"you\s+are\s+now",
    r"act\s+as\s+(if\s+)?",
    r"pretend\s+to\s+be",
    r"roleplay\s+as",
    r"new\s+persona",
    # Structural injection markers
    r"new\s+(instructions?|persona)\s*[:=]",
    r"system\s*[:=]",
    r"assistant\s*[:=]",
    r"system\s+prompt",
    r"do\s+not\s+follow",
    # Extraction attempts
    r"reveal\s+(\w+\s+){0,2}prompt",
    r"show\s+(\w+\s+){0,3}prompt",
    r"what\s+(\w+\s+){0,3}instructions?",
    # Known attack keywords
    r"developer\s+mode",
    r"unrestricted\s+mode",
    r"jailbreak",
]

_INJECTION_REGEX = re.compile(
    "|".join(_INJECTION_PATTERNS),
    re.IGNORECASE,
)


class InjectionDefenseService:
    """
    Stateless service — all methods are static.
    Call ``defend(text)`` for the full multi-layer check.
    Individual ``_check_*`` methods are exposed for unit testing.
    """

    @staticmethod
    def defend(text: str) -> None:
        """
        Run all defence layers against *text*.
        Raises ``InjectionDetectedError`` on the first violation found.
        Callers are responsible for translating this into the appropriate
        transport-layer error (e.g. HTTP 400).
        """
        InjectionDefenseService._check_encoding_attacks(text)
        InjectionDefenseService._check_invisible_unicode(text)
        InjectionDefenseService._check_direct_patterns(text)
        InjectionDefenseService._check_typoglycemia(text)

    @staticmethod
    def _check_encoding_attacks(text: str) -> None:
        """
        Raises if the text contains base64 or hex payloads that, when
        decoded, reveal known injection keywords.
        """
        if InjectionDefenseService._has_base64_injection(
                text
        ) or InjectionDefenseService._has_hex_injection(text):
            raise InjectionDetectedError("Encoding-based injection attempt detected.")

    @staticmethod
    def _has_base64_injection(text: str) -> bool:
        pattern = re.compile(r"[A-Za-z0-9+/]{4,}={0,2}")
        for match in pattern.finditer(text):
            token = match.group()
            if len(token) < 4:
                continue
            try:
                decoded = base64.b64decode(token, validate=True).decode(
                    "utf-8", errors="ignore"
                ).lower()
                if any(kw in decoded for kw in _ENCODED_KEYWORDS):
                    return True
            except Exception:
                continue
        return False

    @staticmethod
    def _has_hex_injection(text: str) -> bool:
        pattern = re.compile(r"[0-9a-fA-F]{20,}")
        for match in pattern.finditer(text):
            token = match.group()
            try:
                decoded = binascii.unhexlify(token).decode(
                    "utf-8", errors="ignore"
                ).lower()
                if any(kw in decoded for kw in _ENCODED_KEYWORDS):
                    return True
            except Exception:
                continue
        return False

    @staticmethod
    def _check_invisible_unicode(text: str) -> None:
        """
        Raises if zero-width spaces, joiners, or BOM characters are present.
        These are used to smuggle hidden text past naive scanners.
        """
        # ​–‍  zero-width space / non-joiner / joiner
        # ﻿          BOM / zero-width no-break space
        if re.search(r"[​-‍﻿]", text):
            raise InjectionDetectedError("Invisible Unicode characters detected.")

    @staticmethod
    def _check_direct_patterns(text: str) -> None:
        """Raises if any known injection phrase is found via regex."""
        if _INJECTION_REGEX.search(text):
            raise InjectionDetectedError("Injection pattern detected.")

    @staticmethod
    def _check_typoglycemia(text: str) -> None:
        """
        Raises if any word in *text* looks like a scrambled version of a
        known injection term (typoglycemia attack).

        Only checks against ``_TYPOGLYCEMIA_TERMS``, which excludes common
        professional vocabulary to prevent false positives in CV / JD text.
        """
        for word in text.split():
            clean = re.sub(r"[^a-zA-Z]", "", word).lower()
            if not clean:
                continue
            if InjectionDefenseService._is_typoglycemia(clean):
                raise InjectionDetectedError("Injection attempt detected.")

    @staticmethod
    def _is_typoglycemia(word: str) -> bool:
        """
        Returns True if *word* appears to be a scrambled injection term
        but is NOT actually that term spelled correctly.

        Logic:
          - Same length as a known term
          - First and last letters match
          - Middle letters are a permutation of the term's middle
          - Word is NOT the term itself (correct spelling is allowed)
        """
        for term in _TYPOGLYCEMIA_TERMS:
            if word == term:
                continue
            if len(word) != len(term):
                continue
            if word[0] != term[0] or word[-1] != term[-1]:
                continue
            middle_word = Counter(word[1:-1])
            middle_term = Counter(term[1:-1])
            if middle_word == middle_term:
                return True
        return False
