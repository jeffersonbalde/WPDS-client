import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AdmissionViewModal from '../components/admissions/AdmissionViewModal'

export default function AdmissionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  function handleClose() {
    if (user?.role === 'registrar') {
      navigate('/admissions-manage')
      return
    }
    navigate('/admissions')
  }

  return <AdmissionViewModal admissionId={id} onClose={handleClose} />
}
