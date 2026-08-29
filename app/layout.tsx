import type { Metadata } from 'next';
import './globals.css';
import './hierarchy.css';

export const metadata: Metadata = { title: 'MEP Tempo — Minuteur de mise en production', description: 'Préparez, lancez et suivez vos mises en production étape par étape.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="fr"><body>{children}</body></html>; }
