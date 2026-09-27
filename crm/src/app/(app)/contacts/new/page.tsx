import { ContactForm } from "@/components/ContactForm";
import { createContact } from "@/lib/actions/contacts";

export default function NewContactPage() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-text">Add Contact</h1>
      </header>
      <ContactForm action={createContact} submitLabel="Create Contact" />
    </div>
  );
}
