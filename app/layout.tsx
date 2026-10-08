import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Know Me or Not? — The Friendship Guessing Game', description: 'You think you know your friends? Prove it in a live social guessing game for 2–8 players.', manifest: '/manifest.webmanifest', icons: { icon: '/favicon.svg', apple: '/icon-192.svg' }, openGraph: { title: 'Know Me or Not?', description: 'Read the room. Guess your friends. Claim the crown.', type: 'website' } };
export const viewport: Viewport = { themeColor: '#f4f2e9', width: 'device-width', initialScale: 1, viewportFit: 'cover' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}<script dangerouslySetInnerHTML={{__html:"if('serviceWorker'in navigator){addEventListener('load',()=>navigator.serviceWorker.register('/sw.js'))}"}} /></body></html>; }
