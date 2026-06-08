"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { searchGuides } from "./helpSearch";

function GuideCard({ g, showRole }) {
  return (
    <Link
      href={`/help/${g.role}/${g.slug}/`}
      className="block ui-card hover:-translate-y-px hover:shadow-md no-underline group"
    >
      {showRole && (
        <span className="text-[0.65rem] font-extrabold uppercase tracking-widest text-accent">
          {g.role}
        </span>
      )}
      <h3 className="text-base font-bold mt-1 group-hover:text-accent transition-colors leading-snug">
        {g.title}
      </h3>
      <p className="text-sm text-gray-500 mt-1 leading-relaxed">{g.summary}</p>
    </Link>
  );
}

export default function HelpBrowser({ roles, categories, guides }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  const results = useMemo(() => searchGuides(query, guides), [query, guides]);

  const sortedRoles = [...roles].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const sortedCats = [...categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <div>
      <div className="relative mb-12">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="search" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search help…" autoFocus
          className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-200 bg-white text-base shadow-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </div>

      {results ? (
        results.length === 0 ? (
          <p className="text-gray-500">No results for &ldquo;{q}&rdquo;. Try a different word.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {results.map((g) => <GuideCard key={`${g.role}/${g.slug}`} g={g} showRole />)}
          </div>
        )
      ) : (
        <div className="space-y-16">
          {sortedRoles.map((role) => {
            const roleGuides = guides.filter((g) => g.role === role.id);
            if (roleGuides.length === 0) return null;
            return (
              <section key={role.id}>
                <h2 className="text-2xl font-black tracking-tight mb-1">{role.label}</h2>
                <div className="h-1 w-12 bg-accent rounded-full mb-8" />
                <div className="space-y-10">
                  {sortedCats.map((cat) => {
                    const items = roleGuides
                      .filter((g) => g.category === cat.id)
                      .sort((a, b) => a.order - b.order);
                    if (items.length === 0) return null;
                    return (
                      <div key={cat.id}>
                        <h3 className="text-[0.7rem] font-extrabold uppercase tracking-[0.18em] text-gray-500 mb-4">
                          {cat.label}
                        </h3>
                        <div className="grid sm:grid-cols-2 gap-4">
                          {items.map((g) => <GuideCard key={`${g.role}/${g.slug}`} g={g} />)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
