import type {Metadata} from 'next';
import type {ReactNode} from 'react';

export const metadata: Metadata = {
  title: 'Competitor Intelligence',
  description: 'Competitor intelligence workshop application',
};

export default function RootLayout({children}: Readonly<{children: ReactNode}>) {
  return <html lang="en"><body>{children}</body></html>;
}
