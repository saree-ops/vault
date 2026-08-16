import { supabase } from './supabase'

// Build the public view URL for a stored object key.
export function mediaUrl(key) {
  const base = import.meta.env.VITE_R2_PUBLIC_BASE || ''
  return `${base}/${key}`
}

async function authToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token
}

// Upload one file to R2: ask our function for a one-time link, then PUT the file.
export async function uploadToR2(file, key) {
  const contentType = file.type || 'application/octet-stream'
  const token = await authToken()

  const res = await fetch('/.netlify/functions/upload-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ key, contentType }),
  })
  if (!res.ok) {
    throw new Error('Could not get an upload link — is the function running (netlify dev)?')
  }

  const { url } = await res.json()
  const put = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  })
  if (!put.ok) {
    throw new Error('Upload to storage failed — check the bucket CORS policy.')
  }
  return key
}

// Delete a list of object keys from R2.
export async function deleteFromR2(keys) {
  if (!keys || keys.length === 0) return
  const token = await authToken()
  const res = await fetch('/.netlify/functions/delete-media', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ keys }),
  })
  if (!res.ok) throw new Error('Could not delete files from storage.')
}