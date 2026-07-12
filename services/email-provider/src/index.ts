import { createEmailProviderApp } from './app.js'
import { loadEmailProviderConfig } from './config.js'
import { createDirectMailOtpMailer, createDirectMailRuntime } from './directmail.js'

const config = loadEmailProviderConfig()
const runtime = createDirectMailRuntime({
  roleName: config.roleName,
  disableImdsV1: config.disableImdsV1,
  endpoint: config.endpoint,
  regionId: config.regionId,
})
const mailer = createDirectMailOtpMailer({
  client: runtime.client,
  accountName: config.accountName,
  templateId: config.templateId,
})
const app = createEmailProviderApp({
  mailer,
  serviceToken: config.serviceToken,
  checkReady: runtime.checkReady,
  reportError: (diagnostic) => process.stderr.write(`${JSON.stringify(diagnostic)}\n`),
})

app.listen(config.port)
