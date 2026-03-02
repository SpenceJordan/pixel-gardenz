import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '🌱 Pixel Garden',
  description: 'A pixel art farming and animal shelter game',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323:wght@400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
