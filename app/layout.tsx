import type {Metadata} from 'next';
import type {ReactNode} from 'react';
import {Theme} from '@carbon/react';
import localFont from 'next/font/local';
import '@/styles/globals.scss';

const plexSans = localFont({
  src: [
    {path: '../node_modules/@ibm/plex-sans/fonts/split/woff2/IBMPlexSans-Regular-Latin1.woff2', weight: '400', style: 'normal'},
    {path: '../node_modules/@ibm/plex-sans/fonts/split/woff2/IBMPlexSans-Medium-Latin1.woff2', weight: '500', style: 'normal'},
    {path: '../node_modules/@ibm/plex-sans/fonts/split/woff2/IBMPlexSans-SemiBold-Latin1.woff2', weight: '600', style: 'normal'},
  ],
  variable: '--font-ibm-plex-sans', display: 'swap',
});

const plexMono = localFont({
  src: [
    {path: '../node_modules/@ibm/plex-mono/fonts/split/woff2/IBMPlexMono-Regular-Latin1.woff2', weight: '400', style: 'normal'},
    {path: '../node_modules/@ibm/plex-mono/fonts/split/woff2/IBMPlexMono-Medium-Latin1.woff2', weight: '500', style: 'normal'},
    {path: '../node_modules/@ibm/plex-mono/fonts/split/woff2/IBMPlexMono-SemiBold-Latin1.woff2', weight: '600', style: 'normal'},
  ],
  variable: '--font-ibm-plex-mono', display: 'swap',
});

export const metadata: Metadata = {
  title: 'Competitor Intelligence',
  description: 'Competitor intelligence workshop application',
};

export default function RootLayout({children}: Readonly<{children: ReactNode}>) {
  return <html lang="en"><body className={`${plexSans.variable} ${plexMono.variable}`}><Theme theme="white">{children}</Theme></body></html>;
}
