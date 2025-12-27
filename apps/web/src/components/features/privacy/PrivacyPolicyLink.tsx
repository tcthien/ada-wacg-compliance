import Link from 'next/link';

export function PrivacyPolicyLink() {
  return (
    <Link
      href="/privacy"
      className="text-sm text-muted-foreground hover:text-foreground"
    >
      Privacy Policy
    </Link>
  );
}
