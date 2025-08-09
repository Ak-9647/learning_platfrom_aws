import React, { useState } from 'react';

interface Props {
  documentId: string;
  apiBaseUrl?: string;
}

type Access = 'private' | 'org' | 'public';

export function PublishPanel({ documentId, apiBaseUrl = '' }: Props) {
  const [access, setAccess] = useState<Access>('private');
  const [link, setLink] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const publish = async () => {
    setLoading(true);
    setError('');
    try {
      const url = `${apiBaseUrl.replace(/\/$/, '')}/documents/${encodeURIComponent(documentId)}/publish`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access }),
      });
      if (!res.ok) throw new Error(`Publish failed: ${res.status}`);
      const body = await res.json();
      setLink(body.shareableLink || '');
    } catch (e: any) {
      setError(e.message || 'Publish failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section aria-label="Publish Panel" role="region">
      <h3>Publish</h3>
      <div>
        <label htmlFor="publish-access">Access</label>
        <select id="publish-access" value={access} onChange={(e) => setAccess(e.target.value as Access)}>
          <option value="private">Private</option>
          <option value="org">Organization</option>
          <option value="public">Public</option>
        </select>
        <button type="button" onClick={publish} disabled={loading} aria-busy={loading}>
          {loading ? 'Publishing…' : 'Publish'}
        </button>
      </div>
      {link && (
        <p>
          Shareable link: <a href={link}>{link}</a>
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
