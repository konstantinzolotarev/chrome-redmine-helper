import { currentClient } from '@/lib/client.svelte';
import { getIssue, isRedmineError, updateIssue } from '@/lib/redmine';
import { issues } from '@/lib/store/app.svelte';
import { mergeIssue } from '@/lib/store/derive';
import { toast } from '@/lib/store/ui.svelte';

/**
 * Attach a file to an issue.
 *
 * Redmine takes this in two steps: POST the bytes to /uploads.json for a token,
 * then reference that token when updating the issue.
 */
export async function attachFile(issueId: number, file: File): Promise<boolean> {
  const client = currentClient();
  if (!client) {
    toast.show('error', 'Not connected to Redmine yet.');
    return false;
  }

  try {
    const { upload } = await client.uploadFile(file, file.name);

    await updateIssue(client, issueId, {
      uploads: [
        {
          token: upload.token,
          filename: file.name,
          content_type: file.type || 'application/octet-stream',
        },
      ],
    });

    const fresh = await getIssue(client, issueId);
    await issues.update((cache) => ({
      ...cache,
      [String(issueId)]: mergeIssue(cache[String(issueId)], fresh),
    }));

    toast.show('success', `Attached ${file.name}.`);
    return true;
  } catch (error) {
    toast.show('error', isRedmineError(error) ? error.describe() : String(error));
    return false;
  }
}
