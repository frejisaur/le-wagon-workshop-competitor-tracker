import {afterEach, describe, expect, it, vi} from 'vitest';
import {AirtableClient} from '@/lib/airtable/client';
import {EXPORT_FILE, readAttachment, rosterSystem, saveCsv} from '@/lib/airtable/roster-files';

afterEach(() => vi.unstubAllGlobals());

describe('private Airtable CSV attachments', () => {
  it('recovers an interrupted replacement and reuses the identical export on replay', async () => {
    const filename = 'apollo-accounts-enriched.csv';
    const file = (id: string) => ({id, filename, url: 'https://v5.airtableusercontent.com/' + id});
    let saved = [file('old')];
    let uploads = 0;
    let failTrim = true;
    const client = new AirtableClient({baseId: 'base', apiToken: 'fixture', fetch: async (url, init) => {
      if (String(url).startsWith('https://content.airtable.com/')) {
        uploads++;
        expect(JSON.parse(String(init?.body))).toEqual({filename, contentType: 'text/csv', file: Buffer.from('new').toString('base64')});
        saved.push(file('new'));
        return Response.json({id: 'system', fields: {fldExport: saved}});
      }
      if (init?.method === 'PATCH') {
        if (failTrim) { failTrim = false; return new Response(null, {status: 500}); }
        expect(JSON.parse(String(init.body)).records[0].fields[EXPORT_FILE]).toEqual([{id: 'new'}]);
        saved = [file('new')];
      }
      return Response.json({records: [{id: 'system', fields: {[EXPORT_FILE]: saved}}]});
    }});
    vi.stubGlobal('fetch', async (url: URL) => new Response(url.pathname.slice(1)));
    const save = async () => saveCsv(client, await rosterSystem(client), EXPORT_FILE, filename, Buffer.from('new'));
    await expect(save()).rejects.toThrow();
    await save();
    await save();
    expect(saved.map(att => att.id)).toEqual(['new']);
    expect(uploads).toBe(1);
  });
  it('rejects attachment redirects to arbitrary origins before fetching', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(readAttachment('https://example.org/private')).rejects.toThrow('invalid_attachment_origin');
    expect(fetch).not.toHaveBeenCalled();
  });
});
