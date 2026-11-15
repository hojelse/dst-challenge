import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md space-y-3 py-16 text-center">
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="text-sm text-muted-foreground">
        There is no page or publication at this address.
      </p>
      <Link href="/" className="underline">
        Back to search
      </Link>
    </div>
  );
}
