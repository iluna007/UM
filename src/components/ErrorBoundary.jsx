import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="error-boundary-fallback"
          style={{
            padding: '2rem',
            maxWidth: '480px',
            margin: '2rem auto',
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            color: 'var(--color-text)',
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Algo ha fallado</h2>
          <p style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
            Se ha producido un error al cargar esta sección. Prueba a recargar la página o a cambiar de pestaña.
          </p>
          {this.state.error && (
            <pre
              style={{
                fontSize: '0.75rem',
                overflow: 'auto',
                padding: '0.75rem',
                background: 'var(--color-bg)',
                borderRadius: '4px',
                margin: 0,
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
          >
            Reintentar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
