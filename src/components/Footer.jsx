export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="footer">
      <p className="footer-content">
        <span>© {year} </span>
        <a href="https://florence-to.com/" target="_blank" rel="noopener noreferrer">
          Florence
        </a>
        <span>. All rights reserved.</span>
        <span className="footer-separator"> · </span>
        <span>Web development by </span>
        <a href="https://ikerluna.netlify.app/" target="_blank" rel="noopener noreferrer">
          Iker Luna
        </a>
      </p>
    </footer>
  )
}
