export default function ProjectRow({ item }) {
  const status = item.others?.status ?? ''
  return (
    <>
      <span className="project-date">{item.date}</span>
      <span className="project-title">{item.title ?? ''}</span>
      <span className="project-category">
        {Array.isArray(item.category) ? item.category.join(' · ') : item.category}
      </span>
      <span className="project-status">{status}</span>
    </>
  )
}
