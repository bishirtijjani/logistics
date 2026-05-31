"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { searchGuides } from "./helpSearch";

export default function HelpSidebar({ roles, categories, guides, current }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const currentRole = current.split("/")[0];

  const matchedSet = useMemo(
    () => (query ? new Set((searchGuides(query, guides) || []).map((g) => g.slug)) : null),
    [query, guides]
  );
  const matches = (g) => !matchedSet || matchedSet.has(g.slug);

  const catOrder = Object.fromEntries((categories || []).map((c) => [c.id, c.order ?? 0]));
  const sortedCats = [...(categories || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const sortedRoles = [...(roles || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const firstGuideFor = (roleId) =>
    guides
      .filter((g) => g.role === roleId)
      .sort((a, b) => (catOrder[a.category] - catOrder[b.category]) || a.order - b.order)[0];

  return (
    <nav className="text-sm">
      {/* Role switcher */}
      {sortedRoles.length > 1 && (
        <div className="flex gap-1 mb-5 p-1 bg-gray-100 rounded-xl">
          {sortedRoles.map((r) => {
            const fg = firstGuideFor(r.id);
            const active = r.id === currentRole;
            return (
              <Link
                key={r.id}
                href={fg ? `/help/${fg.role}/${fg.slug}/` : "/help"}
                className={`flex-1 text-center px-2 py-1.5 rounded-lg text-xs font-bold no-underline transition-colors ${
                  active ? "bg-white shadow-sm text-accent" : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {r.label.replace(/^For\s+/, "")}
              </Link>
            );
          })}
        </div>
      )}

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search help…"
        className="w-full px-3.5 py-2.5 mb-5 rounded-xl border border-gray-200 bg-white shadow-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
      />

      {sortedCats.map((cat) => {
        const items = guides
          .filter((g) => g.role === currentRole && g.category === cat.id && matches(g))
          .sort((a, b) => a.order - b.order);
        if (items.length === 0) return null;
        return (
          <div key={cat.id} className="mb-6">
            <p className="text-[0.65rem] font-extrabold uppercase tracking-widest text-gray-400 mb-2">
              {cat.label}
            </p>
            <ul className="space-y-0.5">
              {items.map((g) => {
                const slug = `${g.role}/${g.slug}`;
                const active = slug === current;
                return (
                  <li key={slug}>
                    <Link
                      href={`/help/${slug}/`}
                      className={`block px-3 py-2 rounded-lg no-underline transition-colors ${
                        active ? "text-accent font-semibold" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      }`}
                      style={active ? { backgroundColor: "var(--color-accent-dim)" } : undefined}
                    >
                      {g.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
