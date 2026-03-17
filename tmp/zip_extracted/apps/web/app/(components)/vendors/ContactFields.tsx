"use client";

import React from "react";

export type Contact = {
  name?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

type Props = {
  contacts: Contact[];
  onChange: (contacts: Contact[]) => void;
};

export function ContactFields({ contacts, onChange }: Props) {
  const update = (idx: number, patch: Partial<Contact>) => {
    const next = contacts.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const add = () => {
    if (contacts.length >= 3) return;
    const newContact: Contact = { name: "", phone: null, email: null, address: null };
    const next: Contact[] = [...contacts, newContact];
    onChange(next);
  };

  const remove = (idx: number) => {
    const next = contacts.slice();
    next.splice(idx, 1);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-100">Contacts (max 3)</h3>
        <button
          type="button"
          onClick={add}
          className="text-sm text-blue-400 hover:underline disabled:opacity-50"
          disabled={contacts.length >= 3}
        >
          Add contact
        </button>
      </div>
      {contacts.length === 0 && (
        <div className="text-sm text-gray-400">No contacts yet.</div>
      )}
      <div className="space-y-3">
        {contacts.map((c, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 space-y-2"
          >
            <div className="flex items-center justify-between text-sm text-gray-300">
              <span>Contact #{idx + 1}</span>
              <button
                type="button"
                onClick={() => remove(idx)}
                className="text-red-400 hover:underline text-xs"
              >
                Remove
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                className="border border-slate-700 bg-slate-800 rounded px-3 py-2 text-gray-100 placeholder:text-gray-400"
                placeholder="Name"
                value={c.name}
                onChange={(e) => update(idx, { name: e.target.value })}
                required
              />
              <input
                className="border border-slate-700 bg-slate-800 rounded px-3 py-2 text-gray-100 placeholder:text-gray-400"
                placeholder="Phone"
                value={c.phone ?? ""}
                onChange={(e) => update(idx, { phone: e.target.value })}
              />
              <input
                className="border border-slate-700 bg-slate-800 rounded px-3 py-2 text-gray-100 placeholder:text-gray-400"
                placeholder="Email"
                value={c.email ?? ""}
                onChange={(e) => update(idx, { email: e.target.value })}
              />
              <input
                className="border border-slate-700 bg-slate-800 rounded px-3 py-2 text-gray-100 placeholder:text-gray-400"
                placeholder="Address"
                value={c.address ?? ""}
                onChange={(e) => update(idx, { address: e.target.value })}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
