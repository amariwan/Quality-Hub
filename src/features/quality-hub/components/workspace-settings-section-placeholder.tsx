import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function WorkspaceSettingsSectionPlaceholder({
  heading,
  description,
  bullets
}: {
  heading: string;
  description: string;
  bullets: string[];
}) {
  return (
    <Card className='border-dashed'>
      <CardHeader className='gap-2'>
        <div className='flex items-center gap-2'>
          <CardTitle>{heading}</CardTitle>
          <Badge variant='secondary'>Coming soon</Badge>
        </div>
        <p className='text-muted-foreground text-sm'>{description}</p>
      </CardHeader>
      <CardContent className='space-y-2'>
        <p className='text-muted-foreground text-sm'>
          This section is being built and will be available in an upcoming
          release.
        </p>
        <ul className='text-muted-foreground list-disc space-y-1 pl-5 text-sm'>
          {bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
