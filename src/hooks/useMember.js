import { useState, useEffect } from 'react'
import { db } from '../lib/supabase.js'

export function useMember() {
  const [member, setMember] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    function fetchMember() {
      const memberId = localStorage.getItem('memberId')
      if (!memberId) {
        setLoading(false)
        return
      }
      db.getMemberById(memberId).then(({ data, error: err }) => {
        if (err) {
          setError(err.message || 'Failed to load member data.')
        } else {
          setMember(data)
        }
        setLoading(false)
      })
    }

    fetchMember()
    window.addEventListener('memberLogin', fetchMember)
    return () => window.removeEventListener('memberLogin', fetchMember)
  }, [])

  return { member, loading, error }
}
