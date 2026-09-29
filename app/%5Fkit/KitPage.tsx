'use client';

import { useState, type ReactNode } from 'react';
import {
  Bell,
  CalendarDays,
  Building2,
  CircleCheck,
  Clock,
  FileText,
  Inbox,
  ListChecks,
  Mail,
  Phone,
  Plus,
  Search,
  SearchX,
  Tag,
  Timer,
  Upload,
  User,
  X,
} from 'lucide-react';
import {
  AddChip,
  AutoTag,
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  Chip,
  CountBadge,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  Kbd,
  LoadingState,
  Modal,
  RadioOption,
  SegmentedControl,
  Select,
  Skeleton,
  SkeletonRows,
  Slider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  TextInput,
  TokenChip,
  Tooltip,
  Truncate,
  useToast,
  type ButtonVariant,
} from '@/src/components/ui';
import {
  APPLICATION_STATUSES,
  CLIENT_STATUSES,
  COMMISSION_PCT_RANGE,
  DOCUMENT_STATUSES,
  LOSS_REASONS,
  STAGES,
  TONES,
  type Tone,
} from '@/src/lib/constants';
import { formatMoney, formatMoneyCompact } from '@/src/lib/format';

// Sample rows taken from the design reference.
const CLIENTS = [
  {
    name: 'Agro-Skhid LLC',
    last: 'today',
    code: '40218763',
    industry: 'Grain farming',
    region: 'Kharkiv',
    turnover: 86e6,
    deals: '1 · 8.5M ₴',
    owner: 'Olena Koval',
    contact: '+380 67 412 58 03',
    status: 'Active' as const,
  },
  {
    name: 'Hnatiuk Oksana P. (sole prop.)',
    last: 'yesterday',
    code: '3124509876',
    industry: 'Coffee shop “Zerno”',
    region: 'Lviv',
    turnover: 4.2e6,
    deals: '1 · 600K ₴',
    owner: 'Olena Koval',
    contact: '+380 97 205 11 84',
    status: 'Active' as const,
  },
  {
    name: 'Poltava Mill LLC',
    last: '2 days ago',
    code: '38451290',
    industry: 'Flour milling',
    region: 'Poltava',
    turnover: 61e6,
    deals: '1 · 3.2M ₴',
    owner: 'Olena Koval',
    contact: '+380 66 734 90 12',
    status: 'Active' as const,
    duplicate: true,
  },
  {
    name: 'Boiko Andrii M. (sole prop.)',
    last: '42 days ago',
    stale: true,
    code: '3045571829',
    industry: 'Car service',
    region: 'Khmelnytskyi',
    turnover: 5.1e6,
    deals: '—',
    owner: 'Olena Koval',
    contact: '+380 98 160 72 35',
    status: 'Inactive' as const,
  },
];

const CLIENT_COLUMNS =
  'minmax(180px,2.2fr) 96px minmax(0,1.3fr) minmax(0,0.9fr) 92px 118px 128px 88px 86px';

const DEALS = [
  {
    name: 'Budmontazh-Invest LLC',
    stage: 5,
    product: 'Loan',
    amount: 12e6,
    days: 20,
    owner: 'Mariia Tkachenko',
  },
  {
    name: 'Translogistic West LLC',
    stage: 4,
    product: 'Leasing',
    amount: 7.4e6,
    days: 4,
    owner: 'Olena Koval',
  },
  {
    name: 'Smart Pack Ukraine LLC',
    stage: 3,
    product: 'Overdraft',
    amount: 900_000,
    days: 1,
    owner: 'Olena Koval',
  },
];

const DEAL_COLUMNS = 'minmax(180px,2fr) 150px 110px 120px 90px 60px 110px 130px';

const BUTTON_VARIANTS: { variant: ButtonVariant; label: string }[] = [
  { variant: 'primary', label: 'New lead' },
  { variant: 'secondary', label: 'Import' },
  { variant: 'secondary-danger', label: 'Mark as lost' },
  { variant: 'accent-outline', label: 'Schedule' },
  { variant: 'success', label: 'Confirm disbursement' },
  { variant: 'warning', label: 'Request merge' },
  { variant: 'danger', label: 'Mark as lost' },
  { variant: 'warning-outline', label: 'Compare' },
  { variant: 'danger-outline', label: 'Remind me later' },
  { variant: 'link', label: 'Full pipeline →' },
  { variant: 'link-muted', label: 'Reset' },
];

export function KitPage() {
  const toast = useToast();
  const [count, setCount] = useState(3);
  const [chips, setChips] = useState(['Status: Active', 'Form: LLC', 'Region: Kyiv']);
  const [done, setDone] = useState(false);
  const [doneSm, setDoneSm] = useState(true);
  const [role, setRole] = useState<'manager' | 'head'>('manager');
  const [view, setView] = useState<'kanban' | 'table'>('kanban');
  const [timeline, setTimeline] = useState<'all' | 'manual' | 'auto'>('all');
  const [pct, setPct] = useState<number>(COMMISSION_PCT_RANGE.default);
  const [cursor, setCursor] = useState(0);
  const [lostOpen, setLostOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  const moveWithUndo = () => {
    const previous = count;
    setCount(previous + 1);
    toast.show({
      message: '“Translogistic” → “Bank decisions” · 1 task created',
      onUndo: () => setCount(previous),
    });
  };

  return (
    <div className="mx-auto flex max-w-content flex-col gap-8 px-6 pt-5 pb-16">
      <header>
        <h1 className="text-title font-semibold">UI kit</h1>
        <p className="mt-0.75 text-text-muted">
          Shared components from <code className="font-mono text-sm">src/components/ui</code>. Hover
          and Tab through them to see hover and focus states.
        </p>
      </header>

      <Section title="Buttons" note="Sizes: xs 24 · sm 26 · md 28 · lg 30 (default)">
        <Row label="Variants (lg)">
          {BUTTON_VARIANTS.map(({ variant, label }) => (
            <Button key={variant} variant={variant}>
              {label}
            </Button>
          ))}
        </Row>
        <Row label="With icon">
          <Button variant="primary" icon={Plus}>
            New client
          </Button>
          <Button icon={Upload}>Import</Button>
          <Button icon={Phone}>Call</Button>
          <Button icon={Mail}>Email</Button>
          <Button size="md" icon={Timer}>
            Over SLA only
          </Button>
          <Button size="sm" icon={Plus}>
            Application
          </Button>
          <Button size="xs" icon={Clock}>
            Tomorrow
          </Button>
        </Row>
        <Row label="Sizes">
          {(['lg', 'md', 'sm', 'xs'] as const).map((size) => (
            <Button key={size} size={size} variant="primary">
              Size {size}
            </Button>
          ))}
          {(['lg', 'md', 'sm', 'xs'] as const).map((size) => (
            <Button key={size} size={size}>
              Size {size}
            </Button>
          ))}
        </Row>
        <Row label="Disabled">
          <Button variant="primary" disabled>
            Save note
          </Button>
          <Button disabled>Import</Button>
          <Button variant="danger" disabled>
            Mark as lost
          </Button>
        </Row>
        <Row label="Icon buttons">
          <IconButton label="Reminders" variant="outlined">
            <Bell size={18} strokeWidth={1.75} />
          </IconButton>
          <IconButton label="Close">
            <X size={16} strokeWidth={1.75} />
          </IconButton>
        </Row>
      </Section>

      <Section title="Badges">
        <Row label="Tones">
          {(Object.keys(TONES) as Tone[]).map((tone) => (
            <Badge key={tone} tone={tone}>
              {tone}
            </Badge>
          ))}
        </Row>
        <Row label="Deal stages">
          {STAGES.map((stage) => (
            <Badge key={stage.key} tone={stage.tone}>
              {stage.label}
            </Badge>
          ))}
        </Row>
        <Row label="Applications">
          {Object.entries(APPLICATION_STATUSES).map(([key, s]) => (
            <Badge key={key} tone={s.tone}>
              {s.label}
            </Badge>
          ))}
        </Row>
        <Row label="Documents (sm)">
          {Object.entries(DOCUMENT_STATUSES).map(([key, s]) => (
            <Badge key={key} tone={s.tone} size="sm">
              {s.label}
            </Badge>
          ))}
        </Row>
        <Row label="Client status · flags">
          {Object.entries(CLIENT_STATUSES).map(([key, s]) => (
            <Badge key={key} tone={s.tone}>
              {s.label}
            </Badge>
          ))}
          <Badge tone="amber" size="xs" title="Same EDRPOU as another record">
            Duplicate
          </Badge>
          <Badge tone="red" size="sm">
            Overloaded
          </Badge>
          <Badge tone="green" size="sm">
            Lowest rate
          </Badge>
          <Badge tone="amber" size="sm" icon={<FileText size={13} strokeWidth={1.75} />}>
            Tax certificate expires in 4 days
          </Badge>
        </Row>
        <Row label="Counters · auto">
          <span className="flex items-center gap-2 font-semibold">
            Deals at risk <CountBadge tone="red">3</CountBadge>
          </span>
          <CountBadge>8</CountBadge>
          <CountBadge tone="red">9</CountBadge>
          <AutoTag />
          <AutoTag variant="mono" />
        </Row>
      </Section>

      <Section title="Filter chips">
        <Row label="Filters">
          {chips.map((chip) => (
            <Chip key={chip} onRemove={() => setChips(chips.filter((c) => c !== chip))}>
              {chip}
            </Chip>
          ))}
          <AddChip onClick={() => setChips([...chips, `Form: Sole prop. ${chips.length}`])}>
            Filter
          </AddChip>
          <Button variant="link">Save filter</Button>
          <Button variant="link-muted" onClick={() => setChips([])}>
            Reset
          </Button>
        </Row>
        <Row label="Large · read-only">
          <Chip size="lg" onRemove={() => undefined}>
            Manager: Olena Koval
          </Chip>
          <Chip>No remove</Chip>
        </Row>
        <Row label="Parse preview">
          <TokenChip icon={<Tag size={13} />}>Call</TokenChip>
          <TokenChip icon={<CalendarDays size={13} />}>Tomorrow · 15:00</TokenChip>
          <TokenChip icon={<Building2 size={13} />}>Agro-Skhid</TokenChip>
          <TokenChip icon={<Building2 size={13} />} muted>
            Client not recognized
          </TokenChip>
          <TokenChip icon={<User size={13} />}>Olena Koval</TokenChip>
        </Row>
      </Section>

      <Section title="Avatars">
        <Row label="People (circle)">
          {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size) => (
            <Avatar key={size} name="Olena Koval" size={size} tone="accent" />
          ))}
          {(['md', 'xl'] as const).map((size) => (
            <Avatar key={size} name="Ihor Bondar" size={size} />
          ))}
          <Avatar name="Mariia Tkachenko" size="sm" tone="accent" showTitle />
        </Row>
        <Row label="Companies, banks (square)">
          <Avatar name="Agro-Skhid LLC" shape="square" size="md" />
          <Avatar name="Universal Capital" shape="square" size="md" />
          <Avatar name="Agro-Skhid" shape="square" size="2xl" />
        </Row>
      </Section>

      <Section title="Form inputs">
        <div className="grid grid-cols-3 gap-6">
          <div className="flex flex-col gap-3">
            <TextInput
              placeholder="Name, EDRPOU, contact or phone"
              leading={<Search size={16} strokeWidth={1.75} />}
              trailing={<Kbd>/</Kbd>}
            />
            <TextInput
              variant="subtle"
              placeholder="Client, EDRPOU, phone…"
              leading={<Search size={16} strokeWidth={1.75} />}
              trailing={<Kbd>⌘K</Kbd>}
            />
            <Field label="EDRPOU" hint="8 digits for LLC, 10 for sole proprietors">
              {({ id, describedBy }) => (
                <TextInput id={id} aria-describedby={describedBy} defaultValue="40218763" />
              )}
            </Field>
            <Field label="EDRPOU" error="Already exists: “Poltava MILL”, owner Dmytro Savchuk">
              {({ id, describedBy, invalid }) => (
                <TextInput
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  defaultValue="38451290"
                />
              )}
            </Field>
            <TextInput size="sm" defaultValue="Grain farming" aria-label="Industry" />
            <TextInput disabled placeholder="Disabled" />
          </div>
          <div className="flex flex-col gap-3">
            <Textarea rows={2} placeholder="Add a note about the call, agreements, next step…" />
            <Field label="Sort" inline>
              {({ id }) => (
                <Select id={id} size="md" defaultValue="last">
                  <option value="last">Last interaction</option>
                  <option value="turnover">Turnover</option>
                  <option value="name">Name</option>
                </Select>
              )}
            </Field>
            <Field label="Log in as" inline>
              {({ id }) => (
                <Select id={id} defaultValue="u1">
                  <option value="u1">Olena Koval</option>
                  <option value="u2">Ihor Bondar</option>
                </Select>
              )}
            </Field>
            <Select size="sm" aria-label="Reassign" defaultValue="u1" className="w-40">
              <option value="u1">Olena Koval</option>
              <option value="u3">Mariia Tkachenko</option>
            </Select>
            <div className="flex items-center gap-2.5">
              <Slider
                aria-label="Commission rate"
                min={COMMISSION_PCT_RANGE.min}
                max={COMMISSION_PCT_RANGE.max}
                step={COMMISSION_PCT_RANGE.step}
                value={pct}
                onChange={(e) => setPct(Number(e.target.value))}
              />
              <span className="w-11 text-right font-semibold tabular-nums">{pct.toFixed(1)}%</span>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <SegmentedControl
                label="Role"
                emphasis
                value={role}
                onChange={setRole}
                options={[
                  { value: 'manager', label: 'Manager', attrs: { 'data-role-option': 'manager' } },
                  { value: 'head', label: 'Head', attrs: { 'data-role-option': 'head' } },
                ]}
              />
              <SegmentedControl
                label="View"
                value={view}
                onChange={setView}
                options={[
                  { value: 'kanban', label: 'Kanban' },
                  { value: 'table', label: 'Table' },
                ]}
              />
              <SegmentedControl
                label="Timeline filter"
                size="sm"
                value={timeline}
                onChange={setTimeline}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'manual', label: 'Manual' },
                  { value: 'auto', label: 'Automatic' },
                ]}
              />
            </div>
            <Checkbox checked={done} onChange={setDone} label="Mark as done">
              <span>Remind client about bank statement</span>
            </Checkbox>
            <Checkbox checked={doneSm} onChange={setDoneSm} label="Mark as done" size="sm">
              <span className="text-control">Get land lease agreements</span>
            </Checkbox>
            <div className="flex items-center gap-3 text-meta text-text-faint">
              <span>
                <Kbd>/</Kbd> search
              </span>
              <span>
                <Kbd>↑ ↓</Kbd> navigate
              </span>
              <span>
                <Kbd>Enter</Kbd> open card
              </span>
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Table"
        note="44px rows (default) and 40px (compact). Click a row, use Tab + Enter, hover long names."
      >
        <Card className="overflow-hidden">
          <Table columns={CLIENT_COLUMNS} label="Clients">
            <TableHeader>
              <TableHead>Client</TableHead>
              <TableHead>EDRPOU / Tax ID</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Region</TableHead>
              <TableHead align="right">Turnover</TableHead>
              <TableHead align="right">Open deals</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Status</TableHead>
            </TableHeader>
            <TableBody>
              {CLIENTS.map((c, i) => (
                <TableRow
                  key={c.code}
                  selected={cursor === i}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => toast.show({ message: `Open ${c.name}` })}
                >
                  <TableCell className="flex items-center gap-2.25">
                    <Avatar name={c.name} shape="square" />
                    <span className="flex min-w-0 flex-col">
                      <Truncate className="font-medium">{c.name}</Truncate>
                      <span
                        className={
                          c.stale ? 'text-meta text-danger' : 'text-meta text-text-tertiary'
                        }
                      >
                        {c.last}
                      </span>
                    </span>
                    {c.duplicate && (
                      <Badge tone="amber" size="xs" title="Same EDRPOU as another record">
                        Duplicate
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell mono muted>
                    {c.code}
                  </TableCell>
                  <TableCell muted>
                    <Truncate>{c.industry}</Truncate>
                  </TableCell>
                  <TableCell muted>
                    <Truncate>{c.region}</Truncate>
                  </TableCell>
                  <TableCell align="right">{formatMoneyCompact(c.turnover)}</TableCell>
                  <TableCell align="right" muted>
                    {c.deals}
                  </TableCell>
                  <TableCell className="flex items-center gap-1.5">
                    <Avatar name={c.owner} size="sm" tone="accent" />
                    <Truncate className="text-sm text-text-secondary">{c.owner}</Truncate>
                  </TableCell>
                  <TableCell className="text-meta text-text-tertiary">
                    <Truncate>{c.contact}</Truncate>
                  </TableCell>
                  <TableCell>
                    <Badge tone={CLIENT_STATUSES[c.status].tone}>{c.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Card className="overflow-hidden">
          <Table columns={DEAL_COLUMNS} density="compact" label="Deals">
            <TableHeader>
              <TableHead>Client</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Product</TableHead>
              <TableHead align="right">Amount</TableHead>
              <TableHead align="right">In stage</TableHead>
              <TableHead align="right">Prob.</TableHead>
              <TableHead align="right">Exp. commission</TableHead>
              <TableHead>Owner</TableHead>
            </TableHeader>
            <TableBody>
              {DEALS.map((d) => {
                const stage = STAGES[d.stage];
                if (!stage) return null;
                const stuck = d.days > stage.slaDays;
                return (
                  <TableRow key={d.name} onClick={() => toast.show({ message: `Open ${d.name}` })}>
                    <TableCell>
                      <Truncate className="font-medium">{d.name}</Truncate>
                    </TableCell>
                    <TableCell>
                      <Badge tone={stage.tone}>{stage.label}</Badge>
                    </TableCell>
                    <TableCell muted>{d.product}</TableCell>
                    <TableCell align="right">{formatMoney(d.amount)}</TableCell>
                    <TableCell align="right" className={stuck ? 'text-danger' : undefined}>
                      {d.days} / {stage.slaDays} d
                    </TableCell>
                    <TableCell align="right" className="text-text-tertiary">
                      {Math.round(stage.probability * 100)}%
                    </TableCell>
                    <TableCell align="right">
                      {formatMoney(d.amount * 0.02 * stage.probability)}
                    </TableCell>
                    <TableCell muted>
                      <Truncate>{d.owner}</Truncate>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </Section>

      <Section title="Cards">
        <div className="grid grid-cols-[minmax(0,1fr)_var(--fp-aside-width)] gap-3.5">
          <Card>
            <CardHeader
              title={
                <>
                  Deals at risk <CountBadge tone="red">3</CountBadge>
                </>
              }
              caption="Helps decide: which deals to step into today before they breach SLA"
              action={<Button variant="link">Full pipeline →</Button>}
            />
            <div className="p-3.5 text-text-muted">Card body</div>
          </Card>
          <Card>
            <CardHeader title="Open tasks" compact />
            <div className="flex flex-col">
              <div className="flex items-start gap-2.25 border-b border-border-row px-3.5 py-2">
                <Checkbox
                  checked={false}
                  onChange={() => undefined}
                  label="Mark as done"
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-control">
                    Confirm disbursement date with Universal Capital
                  </div>
                  <div className="text-meta text-text-tertiary">Today · 11:00</div>
                </div>
              </div>
              <EmptyState variant="inline" icon={<ListChecks size={22} />} title="No other tasks" />
            </div>
          </Card>
        </div>
      </Section>

      <Section title="Toasts" note="Auto-dismiss after 6 s; hovering pauses the timer.">
        <Row label="Trigger">
          <Button onClick={moveWithUndo}>Move deal (with Undo)</Button>
          <Button onClick={() => toast.show({ message: 'Filter saved to sidebar' })}>
            Success
          </Button>
          <Button
            onClick={() =>
              toast.show({
                kind: 'blocked',
                message:
                  'Can’t move to “Applications submitted”: the deal has no bank applications',
              })
            }
          >
            Blocked action
          </Button>
          <span className="text-text-muted">
            Counter changed by the Undo demo: <b className="text-text">{count}</b>
          </span>
        </Row>
      </Section>

      <Section title="Modal">
        <Row label="Trigger">
          <Button variant="secondary-danger" onClick={() => setLostOpen(true)}>
            Mark as lost
          </Button>
        </Row>
        <Modal
          open={lostOpen}
          onClose={() => setLostOpen(false)}
          title="Mark deal as lost"
          subtitle={`Smart Pack Ukraine LLC · Overdraft · ${formatMoney(900_000)}`}
          footer={
            <>
              <Button onClick={() => setLostOpen(false)}>Cancel</Button>
              <Button
                variant="danger"
                disabled={!reason}
                onClick={() => {
                  setLostOpen(false);
                  toast.show({
                    message: `“Smart Pack” → “Lost” · ${reason}`,
                    onUndo: () => undefined,
                  });
                }}
              >
                Mark as lost
              </Button>
            </>
          }
        >
          <div role="radiogroup" aria-label="Reason" className="flex flex-col gap-1.5">
            <div className="mb-0.5 text-sm text-text-tertiary">
              Reason is required. It feeds the “Loss reasons” report.
            </div>
            {LOSS_REASONS.map((r) => (
              <RadioOption
                key={r}
                name="lost-reason"
                value={r}
                checked={reason === r}
                onChange={setReason}
              >
                {r}
              </RadioOption>
            ))}
          </div>
        </Modal>
      </Section>

      <Section title="Empty and error states">
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <EmptyState
              icon={<Inbox size={22} strokeWidth={1.75} />}
              title="No clients yet"
              description="Create a client manually or import from Excel. EDRPOU duplicates are checked automatically."
              actions={<Button variant="primary">New client</Button>}
            />
          </Card>
          <Card>
            <ErrorState
              onRetry={() => toast.show({ message: 'Reloading…' })}
              onReport={() => undefined}
              code="code: NET_TIMEOUT · 29.09 10:14"
            />
          </Card>
          <Card>
            <EmptyState
              variant="inline"
              icon={<SearchX size={24} strokeWidth={1.75} />}
              title="Nothing found for “zerno lviv”"
              description="Check the spelling or search by EDRPOU / phone number"
              actions={
                <Button size="md" onClick={() => setChips([])}>
                  Clear search and filters
                </Button>
              }
            />
          </Card>
          <Card>
            <EmptyState
              variant="inline"
              icon={<CircleCheck size={24} strokeWidth={1.75} />}
              title="All done"
              description="New tasks will appear automatically."
            />
          </Card>
        </div>
      </Section>

      <Section title="Skeletons">
        <LoadingState />
        <div className="grid grid-cols-3 gap-3">
          <Card className="flex flex-col gap-2 p-3.5">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-6 w-3/5" />
            <Skeleton className="h-1 w-full" />
          </Card>
          <Card className="col-span-2 p-4">
            <SkeletonRows rows={3} />
          </Card>
        </div>
      </Section>

      <Section title="Tooltip">
        <Row label="Hover or focus">
          <Tooltip content="Created automatically">
            <Button size="sm">Plain tooltip</Button>
          </Tooltip>
          <Tooltip content="Olena Koval">
            <span
              tabIndex={0}
              className="inline-flex rounded-full focus-visible:outline-none focus-visible:shadow-focus"
            >
              <Avatar name="Olena Koval" size="sm" tone="accent" />
            </span>
          </Tooltip>
          <span className="w-48 rounded-control border border-border bg-surface px-2.5 py-1.5">
            <Truncate>Budmontazh-Invest LLC · Warehouse complex construction</Truncate>
          </span>
          <span className="w-48 rounded-control border border-border bg-surface px-2.5 py-1.5">
            <Truncate>Short text, no tooltip</Truncate>
          </span>
        </Row>
      </Section>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3 border-b border-border pb-2">
        <h2 className="text-heading font-semibold">{title}</h2>
        {note && <span className="text-meta text-text-muted">{note}</span>}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-40 shrink-0 pt-1.5 text-meta tracking-overline text-text-muted uppercase">
        {label}
      </div>
      <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
