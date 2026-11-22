import type { ChangeEvent } from 'react';

export function TextField({ id, label, value, onChange, type = 'text', placeholder }: {
  id: string; label: string; value: string; onChange: (id: string, value: string) => void; type?: string; placeholder?: string;
}) {
  return <><label htmlFor={`team-${id}`}>{label}</label><input id={`team-${id}`} type={type} placeholder={placeholder} value={value} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(id, event.target.value)} /></>;
}

export function SelectField({ id, label, value, onChange, options }: {
  id: string; label: string; value: string; onChange: (id: string, value: string) => void; options: (string | number)[][];
}) {
  return <><label htmlFor={`team-${id}`}>{label}</label><select id={`team-${id}`} value={value} onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(id, event.target.value)}>{options.map(([optionValue, text]) => <option key={String(optionValue)} value={String(optionValue)}>{text}</option>)}</select></>;
}

export function CheckField({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label><input id={`team-${id}`} type="checkbox" checked={checked} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.checked)} /> {label}</label>;
}
