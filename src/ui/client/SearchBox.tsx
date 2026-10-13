"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

/** Recherche avec mise à jour de l'URL (partageable, conservée au retour arrière). */
export function SearchBox({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function push(next: string) {
    const sp = new URLSearchParams(params.toString());
    if (next.trim()) sp.set("q", next.trim());
    else sp.delete("q");
    router.replace(`${pathname}${sp.toString() ? `?${sp}` : ""}`, { scroll: false });
  }

  return (
    <form
      role="search"
      className="mp-search"
      onSubmit={(e) => {
        e.preventDefault();
        push(value);
      }}
    >
      <Search aria-hidden />
      <label htmlFor="q" className="mp-visually-hidden">
        Rechercher
      </label>
      <input
        id="q"
        name="q"
        type="search"
        className="mp-input"
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        enterKeyHint="search"
        onChange={(e) => {
          const v = e.target.value;
          setValue(v);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => push(v), 350);
        }}
      />
    </form>
  );
}
