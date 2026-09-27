import Link from "next/link";
import { getAllContacts } from "@/lib/queries";
import { ContactsTable } from "@/components/ContactsTable";

export default async function ContactsPage() {
  const contacts = await getAllContacts();

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">Contacts</h1>
          <p className="mt-1 text-sm text-text-muted">{contacts.length} total.</p>
        </div>
        <Link
          href="/contacts/new"
          className="rounded-lg bg-accent-base px-4 py-2 text-sm font-medium text-white transition hover:bg-accent"
        >
          Add Contact
        </Link>
      </header>

      <ContactsTable contacts={contacts} />
    </div>
  );
}
