import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import AdminLayout from './pages/admin/AdminLayout'
import Products from './pages/admin/Products'
import Catalogues from './pages/admin/Catalogues'
import CatalogueEditor from './pages/admin/CatalogueEditor'
import Catalogue from './pages/public/Catalogue'
import Product from './pages/public/Product'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Products />} />
            <Route path="catalogues" element={<Catalogues />} />
            <Route path="catalogues/:id" element={<CatalogueEditor />} />
          </Route>

          <Route path="/c/:slug" element={<Catalogue />} />
          <Route path="/p/:id" element={<Product />} />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}