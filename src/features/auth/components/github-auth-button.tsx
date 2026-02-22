'use client';

import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';

export default function GithubSignInButton() {
  const GithubIcon = Icons.github;

  return (
    <Button
      className='w-full'
      variant='outline'
      type='button'
      onClick={() => {
        /* no-op */
      }}
    >
      <GithubIcon className='mr-2 h-4 w-4' />
      Continue with Github
    </Button>
  );
}
