"use client";

import { Field, Select } from "@nagori/ui";
import { useRouter } from "next/navigation";
import { type SortKey, SORT_OPTIONS } from "@/lib/sort";

/**
 * Sorting lives in the URL so the order survives a reload and a server action's
 * redirect back to the library.
 */
export function LibrarySort({ value }: { value: SortKey }) {
  const router = useRouter();
  return (
    <Field className="library-sort" label="Sort">
      <Select
        name="sort"
        value={value}
        onValueChange={(next) => {
          const url = new URL(window.location.href);
          url.searchParams.set("tab", "library");
          url.searchParams.set("sort", next);
          router.replace(`${url.pathname}${url.search}`, { scroll: false });
        }}
        options={SORT_OPTIONS}
      />
    </Field>
  );
}
