import { useState, type RefObject } from 'react';
import { Search, X } from 'lucide-react';
import {
  AddChip,
  Button,
  Chip,
  Kbd,
  Menu,
  MenuItem,
  MenuLabel,
  Popover,
  Select,
  TextInput,
} from '@/src/components/ui';
import {
  chipLabel,
  CLIENT_SORTS,
  sameChip,
  type ClientSort,
  type FilterChip,
} from '@/src/lib/data/clients';
import type { User } from '@/src/lib/types';
import { cn } from '@/src/lib/cn';

export interface TabItem {
  id: string;
  label: string;
  count: number;
  custom: boolean;
}

/** Saved-filter tabs (built-in + the user's own) with the Sort select on the right. */
export function ViewTabs({
  tabs,
  active,
  onSelect,
  onRemove,
  sort,
  onSort,
}: {
  tabs: TabItem[];
  active: string;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  sort: ClientSort;
  onSort: (sort: ClientSort) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border">
      <div role="tablist" aria-label="Saved filters" className="flex min-w-0 gap-4 overflow-x-auto">
        {tabs.map((tab) => {
          const on = tab.id === active;
          return (
            <span key={tab.id} className="group relative flex shrink-0 items-center">
              <button
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => onSelect(tab.id)}
                className={cn(
                  '-mb-px flex h-control-lg items-center gap-1.5 border-b-2 px-0.5 text-control transition-colors',
                  'focus-visible:outline-none focus-visible:shadow-focus',
                  on
                    ? 'border-text font-medium text-text'
                    : 'border-transparent text-text-tertiary hover:text-text',
                  tab.custom && 'pr-4',
                )}
              >
                {tab.label}
                <span className="text-caption text-text-faint tabular-nums">{tab.count}</span>
              </button>
              {tab.custom && (
                <button
                  type="button"
                  aria-label={`Delete saved filter “${tab.label}”`}
                  title="Delete saved filter"
                  onClick={() => onRemove(tab.id)}
                  className="absolute right-0 flex size-4 items-center justify-center rounded-full text-text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:bg-surface-hover-menu hover:text-text focus-visible:opacity-100 focus-visible:outline-none focus-visible:shadow-focus"
                >
                  <X size={11} strokeWidth={2} />
                </button>
              )}
            </span>
          );
        })}
      </div>
      <label className="mb-1.5 flex shrink-0 items-center gap-1.5 text-sm text-text-muted">
        Sort
        <Select size="md" value={sort} onChange={(e) => onSort(e.target.value as ClientSort)}>
          {CLIENT_SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
      </label>
    </div>
  );
}

export interface FilterPreset {
  group: string;
  chip: FilterChip;
}

export interface ClientsToolbarProps {
  searchRef: RefObject<HTMLInputElement | null>;
  query: string;
  onQuery: (q: string) => void;
  chips: FilterChip[];
  onChips: (chips: FilterChip[]) => void;
  presets: FilterPreset[];
  users: User[];
  onSave: (label: string) => void;
  onReset: () => void;
}

export function ClientsToolbar({
  searchRef,
  query,
  onQuery,
  chips,
  onChips,
  presets,
  users,
  onSave,
  onReset,
}: ClientsToolbarProps) {
  const [menu, setMenu] = useState(false);
  const available = presets.filter((p) => !chips.some((c) => sameChip(c, p.chip)));
  const groups = [...new Set(available.map((p) => p.group))];
  const hasFilter = chips.length > 0 || query.trim().length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <TextInput
        ref={searchRef}
        className="w-85"
        aria-label="Search clients"
        placeholder="Name, EDRPOU, contact or phone"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        leading={<Search size={16} strokeWidth={1.75} />}
        trailing={<Kbd>/</Kbd>}
      />
      {chips.map((chip) => (
        <Chip
          key={`${chip.field}:${chip.value}`}
          onRemove={() => onChips(chips.filter((c) => !sameChip(c, chip)))}
          removeLabel={`Remove filter ${chipLabel(chip, users)}`}
        >
          {chipLabel(chip, users)}
        </Chip>
      ))}
      <Popover
        open={menu}
        onClose={() => setMenu(false)}
        className="max-h-80 w-52 overflow-auto"
        anchor={
          <AddChip expanded={menu} onClick={() => setMenu((v) => !v)}>
            Filter
          </AddChip>
        }
      >
        <Menu label="Add filter">
          {groups.length === 0 && <MenuLabel>All filters applied</MenuLabel>}
          {groups.map((group) => (
            <div key={group} className="flex flex-col">
              <MenuLabel>{group}</MenuLabel>
              {available
                .filter((p) => p.group === group)
                .map((p) => (
                  <MenuItem
                    key={`${p.chip.field}:${p.chip.value}`}
                    onSelect={() => {
                      onChips([...chips, p.chip]);
                      setMenu(false);
                    }}
                  >
                    {chipLabel(p.chip, users).replace(/^[^:]+: /, '')}
                  </MenuItem>
                ))}
            </div>
          ))}
        </Menu>
      </Popover>
      {hasFilter && (
        <>
          <SaveFilter
            suggestion={[
              ...(query.trim() ? [`“${query.trim()}”`] : []),
              ...chips.map((c) => chipLabel(c, users).replace(/^[^:]+: /, '')),
            ].join(' · ')}
            onSave={onSave}
          />
          <Button variant="link-muted" onClick={onReset}>
            Reset
          </Button>
        </>
      )}
    </div>
  );
}

function SaveFilter({
  suggestion,
  onSave,
}: {
  suggestion: string;
  onSave: (label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const save = () => {
    const name = (label || suggestion).trim();
    if (!name) return;
    onSave(name);
    setOpen(false);
    setLabel('');
  };
  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      className="w-68 p-2.5"
      anchor={
        <Button variant="link" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          Save filter
        </Button>
      }
    >
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label className="text-meta text-text-muted" htmlFor="save-filter-name">
          Name this filter. It will appear as a tab above the list.
        </label>
        <TextInput
          id="save-filter-name"
          autoFocus
          placeholder={suggestion}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button size="md" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="md" variant="primary" type="submit">
            Save
          </Button>
        </div>
      </form>
    </Popover>
  );
}
