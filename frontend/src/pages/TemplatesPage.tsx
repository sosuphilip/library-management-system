import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import type { EmailTemplate } from '../lib/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  LoadingBlock,
  PageHeader,
  Textarea
} from '../components/ui';
import { formatDateTime } from '../lib/format';

const VARIABLES = ['firstName', 'bookTitle', 'dueDate', 'fineRate', 'expiresAt', 'amount', 'reason', 'link', 'ttl'];

const TYPE_LABELS: Record<string, string> = {
  DUE_SOON: 'Due soon',
  OVERDUE: 'Overdue',
  HOLD_AVAILABLE: 'Hold available',
  HOLD_EXPIRED: 'Hold expired',
  PASSWORD_RESET: 'Password reset',
  FINE_CHARGED: 'Fine charged'
};

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const [flash, setFlash] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const templatesQuery = useQuery({
    queryKey: ['templates'],
    queryFn: () => api<{ templates: EmailTemplate[] }>('/admin/templates')
  });

  if (templatesQuery.isLoading) return <LoadingBlock />;
  if (templatesQuery.isError) {
    return <Alert>{templatesQuery.error instanceof Error ? templatesQuery.error.message : 'Failed to load templates.'}</Alert>;
  }

  return (
    <div>
      <PageHeader
        title="Email templates"
        subtitle={
          <span>
            Edit the emails sent by the daily notification sweep. Use{' '}
            <code className="rounded bg-slate-100 px-1 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              {'{variable}'}
            </code>{' '}
            placeholders: {VARIABLES.map((v) => `{${v}}`).join(', ')}.
          </span>
        }
      />

      {flash && (
        <div className="mb-4">
          <Alert kind={flash.kind}>{flash.text}</Alert>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {(templatesQuery.data?.templates ?? []).map((tpl) => (
          <TemplateCard
            key={tpl.type}
            template={tpl}
            onSaved={(text) => {
              setFlash({ kind: 'success', text });
              void queryClient.invalidateQueries({ queryKey: ['templates'] });
            }}
            onError={(text) => setFlash({ kind: 'error', text })}
          />
        ))}
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  onSaved,
  onError
}: {
  template: EmailTemplate;
  onSaved: (text: string) => void;
  onError: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [error, setError] = useState('');

  const save = useMutation({
    mutationFn: () =>
      api(`/admin/templates/${template.type}`, { method: 'PUT', body: { subject, body } }),
    onSuccess: () => {
      setEditing(false);
      onSaved(`Saved the ${TYPE_LABELS[template.type] ?? template.type} template.`);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Could not save the template.');
      onError(err instanceof ApiError ? err.message : 'Could not save the template.');
    }
  });

  function startEdit() {
    setSubject(template.subject);
    setBody(template.body);
    setError('');
    setEditing(true);
  }

  return (
    <Card>
      <CardHeader
        title={TYPE_LABELS[template.type] ?? template.type}
        subtitle={
          <span className="flex items-center gap-2">
            <Badge status={template.isDefault ? 'WAITING' : 'ACTIVE'}>
              {template.isDefault ? 'Default' : 'Custom'}
            </Badge>
            {template.updatedAt && <span className="text-xs text-slate-400 dark:text-slate-500">updated {formatDateTime(template.updatedAt)}</span>}
          </span>
        }
        actions={
          editing ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button loading={save.isPending} onClick={() => save.mutate()}>
                Save
              </Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={startEdit}>
              Edit
            </Button>
          )
        }
      />
      <div className="p-5">
        {editing ? (
          <div className="space-y-3">
            {error && <Alert>{error}</Alert>}
            <Field label="Subject">
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </Field>
            <Field label="Body" hint="One line per paragraph in the email">
              <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
            </Field>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{template.subject}</p>
            <pre className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-900/60 dark:text-slate-400">
              {template.body}
            </pre>
          </div>
        )}
      </div>
    </Card>
  );
}
