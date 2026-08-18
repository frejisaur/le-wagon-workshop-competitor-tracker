import type {Metadata} from 'next';
import type {ReactNode} from 'react';
import {Theme} from '@carbon/react';
import '@/styles/globals.scss';

export const metadata: Metadata = {
  title: 'Competitor Intelligence',
  description: 'Competitor intelligence workshop application',
};

export default function RootLayout({children}: Readonly<{children: ReactNode}>) {
  return <html lang="en"><body><Theme theme="white">{children}</Theme></body></html>;
}
