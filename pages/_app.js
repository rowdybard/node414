import '../styles/globals.css'
import Head from 'next/head'

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>NODE_414 // ACTIVE</title>
        <meta name="description" content="Anonymous localized data stream. Leave your mark for the next rider." />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        
        {/* OpenGraph */}
        <meta property="og:title" content="NODE_414 // ACTIVE" />
        <meta property="og:description" content="Anonymous localized data stream. Leave your mark for the next rider." />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/og-image.png" />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="NODE_414 // ACTIVE" />
        <meta name="twitter:description" content="Anonymous localized data stream. Leave your mark for the next rider." />
        <meta name="twitter:image" content="/og-image.png" />
        
        {/* Theme */}
        <meta name="theme-color" content="#050505" />
        <link rel="icon" href="/favicon.ico" />
        
        {/* Retro Pixel Font */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=VT323&display=swap" rel="stylesheet" />
      </Head>
      <Component {...pageProps} />
    </>
  )
}
