import { useId, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TriangleAlert } from 'lucide-react';
import { Button, Field, Modal, SegmentedControl, Select, TextInput } from '@/src/components/ui';
import { LEAD_SOURCES, PRODUCTS, type LegalForm, type Product } from '@/src/lib/constants';
import type { Dataset, Session } from '@/src/lib/data';
import { existingWithCode } from '@/src/lib/data/duplicates';
import type { NewClientInput, NewLeadInput } from '@/src/lib/data/mutations';
import { codeLabel, normalizeCode, validateCode } from '@/src/lib/rules/duplicates';
import { clientHref } from '../shell/routes';

export interface NewClientModalProps {
  mode: 'client' | 'lead';
  data: Dataset;
  session: Session;
  /** Owner preselected for the head (last manager they logged in as). */
  defaultOwnerId: string;
  onCancel: () => void;
  onCreate: (client: NewClientInput, lead: NewLeadInput | null) => void;
}

const digits = (s: string) => Number(s.replace(/\D/g, '')) || 0;

export function NewClientModal({
  mode,
  data,
  session,
  defaultOwnerId,
  onCancel,
  onCreate,
}: NewClientModalProps) {
  const router = useRouter();
  const regionsId = useId();
  const [form, setForm] = useState({
    legalForm: 'LLC' as LegalForm,
    name: '',
    code: '',
    industry: '',
    region: '',
    turnover: '',
    age: '',
    leadSource: 'Website',
    contactName: '',
    position: '',
    phone: '',
    email: '',
    ownerId: session.role === 'head' ? defaultOwnerId : session.userId,
    product: 'Loan' as Product,
    amount: '',
    purpose: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const codeError = validateCode(form.code, form.legalForm);
  const duplicates = useMemo(
    () => (codeError ? [] : existingWithCode(data, session, form.code)),
    [codeError, data, session, form.code],
  );
  const regions = useMemo(() => [...new Set(data.clients.map((c) => c.region))].sort(), [data]);
  const managers = data.users.filter((u) => u.role === 'manager');

  const errors: Partial<Record<keyof typeof form, string>> = {
    name: form.name.trim() ? undefined : 'Enter the name',
    code: codeError ?? undefined,
    industry: form.industry.trim() ? undefined : 'Enter the industry',
    region: form.region.trim() ? undefined : 'Enter the region',
    contactName: form.contactName.trim() ? undefined : 'Enter a contact person',
    phone: form.phone.replace(/\D/g, '').length >= 10 ? undefined : 'Enter a phone number',
    amount: mode === 'lead' && digits(form.amount) <= 0 ? 'Enter the requested amount' : undefined,
    purpose: mode === 'lead' && !form.purpose.trim() ? 'Enter the purpose' : undefined,
  };
  const valid = Object.values(errors).every((e) => !e);
  const show = (key: keyof typeof form) => (submitted ? errors[key] : undefined);

  const submit = (e?: { preventDefault: () => void }) => {
    e?.preventDefault();
    setSubmitted(true);
    if (!valid) return;
    onCreate(
      {
        name: form.name,
        code: normalizeCode(form.code),
        legalForm: form.legalForm,
        industry: form.industry,
        region: form.region,
        annualTurnover: digits(form.turnover),
        businessAgeYears: digits(form.age),
        leadSource: form.leadSource,
        ownerId: form.ownerId,
        contact: {
          name: form.contactName.trim(),
          position: form.position.trim() || (form.legalForm === 'LLC' ? 'Director' : 'Owner'),
          phone: form.phone.trim(),
          email: form.email.trim() || null,
        },
      },
      mode === 'lead'
        ? { product: form.product, requestedAmount: digits(form.amount), purpose: form.purpose }
        : null,
    );
  };

  const duplicate = duplicates[0];

  return (
    <Modal
      open
      size="lg"
      onClose={onCancel}
      title={mode === 'lead' ? 'New lead' : 'New client'}
      subtitle={
        mode === 'lead'
          ? 'Creates the client, a deal in “New lead” and a call task for tomorrow 10:00'
          : 'EDRPOU duplicates are checked before saving'
      }
      footer={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          {duplicate?.canView && (
            <Button onClick={() => router.push(clientHref(duplicate.id))}>Open existing</Button>
          )}
          <Button variant={duplicate ? 'warning' : 'primary'} onClick={() => submit()}>
            {duplicate ? 'Create anyway' : mode === 'lead' ? 'Create lead' : 'Create client'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-2 gap-x-3 gap-y-2.5" noValidate>
        <div className="col-span-2 flex items-center gap-3">
          <SegmentedControl
            label="Legal form"
            value={form.legalForm}
            onChange={(v) => set('legalForm', v)}
            options={[
              { value: 'LLC', label: 'LLC' },
              { value: 'Sole prop.', label: 'Sole proprietor' },
            ]}
          />
        </div>
        <div className="col-span-2">
          <Field
            label={form.legalForm === 'LLC' ? 'Company name' : 'Full name'}
            error={show('name')}
          >
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder={
                  form.legalForm === 'LLC' ? 'Poltava Mill LLC' : 'Hnatiuk Oksana P. (sole prop.)'
                }
              />
            )}
          </Field>
        </div>
        <Field
          label={codeLabel(form.legalForm)}
          error={
            show('code') ??
            (form.code && codeError && normalizeCode(form.code).length >= 8 ? codeError : undefined)
          }
        >
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={invalid || Boolean(duplicate)}
              inputMode="numeric"
              className="font-mono"
              value={form.code}
              onChange={(e) => set('code', e.target.value.trim())}
              placeholder={form.legalForm === 'LLC' ? '8 digits' : '10 digits'}
            />
          )}
        </Field>
        <Field label="Lead source">
          {({ id }) => (
            <Select
              id={id}
              value={form.leadSource}
              onChange={(e) => set('leadSource', e.target.value)}
            >
              {LEAD_SOURCES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          )}
        </Field>

        {duplicate && (
          <div
            role="alert"
            className="col-span-2 flex gap-2 rounded-card border border-warning-border bg-warning-soft px-3 py-2.25 text-control text-warning-text"
          >
            <TriangleAlert
              size={16}
              strokeWidth={1.75}
              className="mt-0.5 shrink-0 text-warning-icon"
            />
            <span className="text-pretty">
              {codeLabel(form.legalForm)} {duplicate.code} already exists: “{duplicate.name}”, owner
              — {duplicate.ownerName}.{' '}
              {duplicate.canView
                ? 'Open the existing record instead of creating a duplicate.'
                : 'Ask the owner or the head of department before creating a second record.'}
            </span>
          </div>
        )}

        <Field label="Industry" error={show('industry')}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              value={form.industry}
              onChange={(e) => set('industry', e.target.value)}
              placeholder="Flour milling"
            />
          )}
        </Field>
        <Field label="Region" error={show('region')}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              list={regionsId}
              value={form.region}
              onChange={(e) => set('region', e.target.value)}
              placeholder="Poltava"
            />
          )}
        </Field>
        <datalist id={regionsId}>
          {regions.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
        <Field label="Annual turnover, ₴">
          {({ id }) => (
            <TextInput
              id={id}
              inputMode="numeric"
              value={form.turnover}
              onChange={(e) => set('turnover', e.target.value)}
              placeholder="61 000 000"
            />
          )}
        </Field>
        <Field label="Business age, years">
          {({ id }) => (
            <TextInput
              id={id}
              inputMode="numeric"
              value={form.age}
              onChange={(e) => set('age', e.target.value)}
              placeholder="15"
            />
          )}
        </Field>

        <div className="col-span-2 mt-1 text-meta font-medium tracking-overline text-text-faint uppercase">
          Contact person
        </div>
        <Field label="Name" error={show('contactName')}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              value={form.contactName}
              onChange={(e) => set('contactName', e.target.value)}
              placeholder="Halyna Shevchuk"
            />
          )}
        </Field>
        <Field label="Position">
          {({ id }) => (
            <TextInput
              id={id}
              value={form.position}
              onChange={(e) => set('position', e.target.value)}
              placeholder={form.legalForm === 'LLC' ? 'Director' : 'Owner'}
            />
          )}
        </Field>
        <Field label="Phone" error={show('phone')}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              type="tel"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="+380 66 734 90 12"
            />
          )}
        </Field>
        <Field label="Email">
          {({ id }) => (
            <TextInput
              id={id}
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="optional"
            />
          )}
        </Field>

        {session.role === 'head' && (
          <Field label="Owner">
            {({ id }) => (
              <Select id={id} value={form.ownerId} onChange={(e) => set('ownerId', e.target.value)}>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        {mode === 'lead' && (
          <>
            <div className="col-span-2 mt-1 text-meta font-medium tracking-overline text-text-faint uppercase">
              Financing request
            </div>
            <Field label="Product">
              {({ id }) => (
                <Select
                  id={id}
                  value={form.product}
                  onChange={(e) => set('product', e.target.value as Product)}
                >
                  {PRODUCTS.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Requested amount, ₴" error={show('amount')}>
              {({ id, describedBy, invalid }) => (
                <TextInput
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  inputMode="numeric"
                  value={form.amount}
                  onChange={(e) => set('amount', e.target.value)}
                  placeholder="3 200 000"
                />
              )}
            </Field>
            <div className="col-span-2">
              <Field label="Purpose" error={show('purpose')}>
                {({ id, describedBy, invalid }) => (
                  <TextInput
                    id={id}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    value={form.purpose}
                    onChange={(e) => set('purpose', e.target.value)}
                    placeholder="Milling line upgrade"
                  />
                )}
              </Field>
            </div>
          </>
        )}
        {/* Enter in any field submits. */}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
