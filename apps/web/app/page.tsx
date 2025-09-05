export default function Page() {
  return (
    <main style={{ padding: 24 }}>
      <h1>MyWebDrive - Next.js 开发服务器</h1>
      <p>此 Next 应用通过 rewrites 将 /api/v1/* 代理到后端网关。</p>
      <ul>
        <li>当前网关：{process.env.API_BASE_URL || 'http://localhost:9080'}</li>
        <li>开发端口：4000（可在 package.json 脚本修改）</li>
      </ul>
    </main>
  )
}
