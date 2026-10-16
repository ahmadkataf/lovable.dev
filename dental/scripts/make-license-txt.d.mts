// Types of scripts/make-license-txt.mjs for the tests (tests/release-files.test.ts).
export declare const TERMS_MD: string
export declare const LICENSE_TXT: string
/** docs/TERMS.md → the installer's plain text (LF line ends). */
export declare function termsToText(md: string): string
/** build/license.txt's exact bytes: a UTF-8 byte-order mark, then the text with CRLF line ends. */
export declare function licenseFileBytes(md: string): Buffer
