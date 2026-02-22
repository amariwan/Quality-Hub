'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { connectGitlabToken } from '@/features/quality-hub/api/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const defaultGitlabBaseUrl =
  process.env.NEXT_PUBLIC_GITLAB_BASE_URL ?? 'https://gitlab.com';

export default function TokenAuthPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [baseUrl, setBaseUrl] = useState(defaultGitlabBaseUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className='flex min-h-[100dvh] items-center justify-center p-6'>
      <Card className='w-full max-w-lg'>
        <CardHeader>
          <CardTitle>Connect GitLab Token</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          <Input
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder='GitLab base URL'
          />
          <Input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder='Personal Access Token'
            type='password'
          />
          {error && <p className='text-destructive text-sm'>{error}</p>}
          <Button
            disabled={loading || !token.trim()}
            onClick={async () => {
              try {
                setLoading(true);
                setError(null);
                await connectGitlabToken({
                  token: token.trim(),
                  base_url: baseUrl.trim()
                });
                router.push('/dashboard/portfolio');
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : 'Connection failed'
                );
              } finally {
                setLoading(false);
              }
            }}
            className='w-full'
          >
            {loading ? 'Connecting...' : 'Connect'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
