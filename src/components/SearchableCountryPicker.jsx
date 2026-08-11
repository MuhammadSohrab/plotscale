import { Search } from "lucide-react";
import { useId, useMemo, useState } from "react";

export function SearchableCountryPicker({
  countries,
  value,
  onChange,
  label = "Country or territory",
  required = false,
}) {
  const inputId = useId();
  const selected = countries.find((country) => country.code === value);
  const [query, setQuery] = useState(selected?.name ?? "");
  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized || selected?.name === query) return countries.slice(0, 20);
    return countries
      .filter((country) =>
        country.name.toLowerCase().includes(normalized)
        || country.code.toLowerCase().startsWith(normalized))
      .slice(0, 30);
  }, [countries, query, selected?.name]);

  const choose = (country) => {
    setQuery(country.name);
    onChange(country.code);
  };

  return (
    <div className="unit-field searchable-country">
      <label htmlFor={inputId}>{label}</label>
      <div className="searchable-country__input">
        <Search size={16} aria-hidden="true" />
        <input
          id={inputId}
          value={query}
          placeholder="Search 249 countries and territories"
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={Boolean(query !== selected?.name)}
          aria-controls={`${inputId}-options`}
          required={required}
          onChange={(event) => {
            setQuery(event.target.value);
            if (value) onChange("");
          }}
          onFocus={() => {
            if (selected?.name === query) setQuery("");
          }}
          onBlur={() => {
            window.setTimeout(() => {
              const current = countries.find((country) => country.code === value);
              if (current) setQuery(current.name);
            }, 120);
          }}
        />
      </div>
      {query !== selected?.name && (
        <div className="searchable-country__options" id={`${inputId}-options`} role="listbox">
          {matches.map((country) => (
            <button
              key={country.code}
              type="button"
              role="option"
              aria-selected={country.code === value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(country)}
            >
              <span>{country.name}</span>
              <small>{country.code}</small>
            </button>
          ))}
          {!matches.length && <p>No matching country or territory.</p>}
        </div>
      )}
    </div>
  );
}
