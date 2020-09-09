"use strict"

const path = require("path");

const bodyParser = require("koa-bodyparser");
const Koa        = require("koa");
const Router     = require("koa-router");
const send       = require("koa-send");


const SCRIPTS_DIR = path.join(__dirname, "..", "dist");
const STYLES_DIR  = path.join(__dirname, "..", "styles");


module.exports = class Server
{
    constructor(
        root_storage,
        intermediate_storage,
        server_storage,
        client_storage,
        open_ssl
    )
    {
        // this.root_storage         = root_storage;
        // this.intermediate_storage = intermediate_storage;
        // this.client_storage       = client_storage;
        this.storage = {root:         root_storage,
                        intermediate: intermediate_storage,
                        server:       server_storage,
                        client:       client_storage};
        this.open_ssl             = open_ssl;


        this.http_server = new Koa();

        let router = new Router();

        router.get("/", (context) => {
            context.body = ('<html><head><title>Mr. Cert</title>' +
                            '<link rel="stylesheet" type="text/css" href="/styles.css" />' +
                            '</head><body><script src="index.js"></script>' +
                            '</body></html>');
        });
        router.get("/styles.css", async (context, next) => {
            await send(context, "styles.css", {root: STYLES_DIR});
        });
        router.get("/index.js", async (context, next) => {
            await send(context, "index.js", {root: SCRIPTS_DIR});
        });
        router.get("/index.js.map", async (context, next) => {
            await send(context, "index.js.map", {root: SCRIPTS_DIR});
        });


        for (const type in this.storage)
        {
            router.get(`/api/${type}`, async (context, next) => {
                let certs = await this.storage[type].getCerts();
                for (const name in certs)
                {
                    let attributes = {...certs[name]};
                    delete attributes.files;
                    attributes.has_key = certs[name].files.includes("key");

                    certs[name] = attributes;
                }
                context.body = certs;
            });

            router.get(`/api/${type}/text/:name.crt`, async (context, next) => {
                const cert_name = context.params.name;
                const cert_path = this.storage[type].getFilePath(cert_name,
                                                                 "certificate");

                const cert_text = await this.open_ssl.getText(cert_path);
                if (cert_text)
                {
                    context.body = cert_text;
                }
            });

            router.get(`/files/${type}/:name.crt`, async (context, next) => {
                const name = context.params.name;
                await send(context,
                           this.storage[type].getFilePath(name, "certificate"),
                           {root: "/"});
            });

            router.get(`/files/${type}/:name.key`, async (context, next) => {
                const name = context.params.name;
                await send(context,
                           this.storage[type].getFilePath(name, "key"),
                           {root: "/"});
            });
        }

        router.post("/root/create-cert-file", async (context, next) => {
            const cert_name = await this.createRootCert(context.request.body);

            if (cert_name)
            {
                context.body = {new_cert: `${cert_name}.crt`};
            }
            else
            {
                context.status = 500;
            }
        });

        router.post("/intermediate/create-cert-file", async (context, next) => {
            const cert_name = await this.createIntermediateCert(context.request.body);

            if (cert_name)
            {
                context.body = {new_cert: `${cert_name}.crt`};
            }
            else
            {
                context.status = 500;
            }
        });

        router.post("/server/create-cert-file", async (context, next) => {
            const cert_name = await this.createServerCert(context.request.body);

            if (cert_name)
            {
                context.body = {new_cert: `${cert_name}.crt`};
            }
            else
            {
                context.status = 500;
            }
        });

        router.post("/client/create-cert-file", async (context, next) => {
            const cert_name = await this.createClientCert(context.request.body);

            if (cert_name)
            {
                context.body = {new_cert: cert_name};
            }
            else
            {
                context.status = 500;
            }
        });

        router.get('/api/have_certs', async (context, next) => {
            const types = JSON.parse(context.request.query.types);
            let have_certs = false;
            for (const type of types)
            {
                if ( type in this.storage)
                {
                    const certs = await this.storage[type].getCerts(1);
                    if (Object.keys(certs).length > 0)
                    {
                        have_certs = true;
                        break;
                    }
                }
            }
            context.body = {have_certs: have_certs};
        });


        this.http_server.use(bodyParser());
        this.http_server.use(router.routes())
                        .use(router.allowedMethods());
    }

    listen(port)
    {
        this.http_server.listen(port);
    }


    async createRootCert(parameters)
    {
        return await this.open_ssl.makeRootCert(parameters.name,
                                                parameters.key_length,
                                                parameters.digest,
                                                parameters.lifetime,
                                                parameters.common_name,
                                                parameters.country,
                                                parameters.state,
                                                parameters.locality,
                                                parameters.organization,
                                                parameters.organizational_unit,
                                                parameters.email_address,
                                                parameters.intermediate_only,
                                                this.storage.root);
    }

    async createIntermediateCert(parameters)
    {
        const signer_storage = this.storage[parameters.signer.type];
        return await signer_storage.withCert(parameters.signer.name, async (cert) => {
            return await this.open_ssl.makeIntermediateCert(parameters.name,
                                                            cert,
                                                            parameters.key_length,
                                                            parameters.digest,
                                                            parameters.lifetime,
                                                            parameters.common_name,
                                                            parameters.country,
                                                            parameters.state,
                                                            parameters.locality,
                                                            parameters.organization,
                                                            parameters.organizational_unit,
                                                            parameters.email_address,
                                                            this.storage.intermediate);
        });
    }

    async createServerCert(parameters)
    {
        const signer_storage = this.storage[parameters.signer.type];
        return await signer_storage.withCert(parameters.signer.name, async (cert) => {
            return await this.open_ssl.makeServerCert(parameters.name,
                                                      cert,
                                                      parameters.key_length,
                                                      parameters.digest,
                                                      parameters.lifetime,
                                                      parameters.common_name,
                                                      parameters.country,
                                                      parameters.state,
                                                      parameters.locality,
                                                      parameters.organization,
                                                      parameters.organizational_unit,
                                                      parameters.email_address,
                                                      parameters.domain_names,
                                                      this.storage.server);
        });
    }

    async createClientCert(parameters)
    {
        const signer_storage = this.storage[parameters.signer.type];
        let   cert           = await signer_storage.getCert(parameters.signer.name);
        if (!cert)
        {
            return false;
        }
        cert.certificate = path.join(signer_storage.storage_dir, cert.certificate);
        cert.key         = path.join(signer_storage.storage_dir, cert.key);

        const name = await this.open_ssl.makeClientCert(parameters.name,
                                                        cert.certificate,
                                                        cert.key,
                                                        parameters.key_length,
                                                        parameters.digest,
                                                        parameters.lifetime,
                                                        parameters.country,
                                                        parameters.state,
                                                        parameters.locality,
                                                        parameters.organization,
                                                        parameters.organizational_unit,
                                                        parameters.e_mail,
                                                        parameters.common_name,
                                                        parameters.domain_names,
                                                        this.storage.client);

        return name;
    }
};
