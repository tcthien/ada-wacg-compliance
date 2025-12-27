/**
 * Email consent checkbox for GDPR compliance
 * Shown when user provides optional email for scan results
 */

interface EmailConsentCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function EmailConsentCheckbox({
  checked,
  onChange,
}: EmailConsentCheckboxProps) {
  return (
    <label className="flex items-start gap-2 mt-2 text-sm text-muted-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
        aria-label="Consent to receive scan results via email"
      />
      <span>
        I consent to receiving scan results via email. My email will be deleted
        after sending per our{' '}
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          privacy policy
        </a>
        .
      </span>
    </label>
  );
}
