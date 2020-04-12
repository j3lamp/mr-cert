const path = require("path");

const Koa    = require("koa");
const Router = require("koa-router");
const send   = require("koa-send");

const OpenSsl = require("./openSsl");


function link(url_base, file_name, link_name)
{
    return `<a href="${url_base}/${file_name}">${link_name}</a>`;
}

function downloadLink(url_base, file_name, link_name)
{
    return `<a href="${url_base}/${file_name}" download="${file_name}">${link_name}</a>`;
}

function maybeLink(url_base, url_end, link_name)
{
    if (url_end)
    {
        return `<a href="${url_base}/${url_end}">${link_name}</a>`;
    }
    else
    {
        return link_name;
    }
}


module.exports = class Server
{
    constructor(
        root_storage,
        intermediate_storage,
        client_storage
    )
    {
        this.root_storage         = root_storage;
        this.intermediate_storage = intermediate_storage;
        this.client_storage       = client_storage;


        this.http_server = new Koa();

        let router = new Router();

        router.get("/", this.buildPage());

        router.get("/root",         this.buildPage("CA Roots",            this.listCerts(this.root_storage,         "/root")));
        router.get("/intermediate", this.buildPage("CA Intermediates",    this.listCerts(this.intermediate_storage, "/intermediate")));
        router.get("/client",       this.buildPage("Client Certificates", this.listCerts(this.client_storage,       "/client")));

        router.get("/root/files/:file", async (context, next) => {
            await send(context, context.params.file, {root: this.root_storage.storage_dir});
        });
        router.get("/intermediate/files/:file", async (context, next) => {
            await send(context, context.params.file, {root: this.intermediate_storage.storage_dir});
        });
        router.get("/client/files/:file", async (context, next) => {
            await send(context, context.params.file, {root: this.client_storage.storage_dir});
        });

        router.get("/root/text/:file",         this.displayCert("Root",         this.root_storage));
        router.get("/intermediate/text/:file", this.displayCert("Intermediate", this.intermediate_storage));
        router.get("/client/text/:file",       this.displayCert("Client",       this.client_storage));

        this.http_server.use(router.routes())
                        .use(router.allowedMethods());
    }

    listen(port)
    {
        this.http_server.listen(port);
    }


    buildPage(title, content_function)
    {
        let page_title = "Mr. Cert";
        if (title)
        {
            page_title = `${title} - ${page_title}`;
        }

        return async (context, next) =>
            {
                let page = `<html><head><title>${page_title}</title></head><body>`;
                page += `<header><h1>${title}</h1></header>`;
                page += `<nav><ul>`;
                page += `<li><a href="/root">CA Roots</a></li>`;
                page += `<li><a href="/intermediate">CA Intermediates</a></li>`;
                page += `<li><a href="/client">Client Certificates</a></li>`;
                page += `</ul></nav>`;
                page += `<div class="content">`

                if (content_function)
                {
                    page += await content_function(context);
                }

                page += `</div>`;
                page += `<footer>The preferred certificate authority of Dark Helemt</footer>`;
                page += `</body></html>`;

                context.body = page;
            };
    }

    listCerts(cert_storage, url_base)
    {
        const text_url_base = url_base + "/text";
        const file_url_base = url_base + "/files";

        return async () => {
            const certs = await cert_storage.getCerts();

            let list = `<ul class="cert-list">`;
            for (const cert_name in certs)
            {
                if (certs.hasOwnProperty(cert_name))
                {
                    const properties = certs[cert_name];

                    list += `<li>${cert_name}<span class="files">`;
                    if (properties.certificate)
                    {
                        list += ` ` + link(text_url_base, properties.certificate, "View");
                        list += ` ` + downloadLink(file_url_base, properties.certificate, "Certificate");
                    }
                    if (properties.key)
                    {
                        list += ` ` + downloadLink(file_url_base, properties.key, "Key");
                    }
                    list += `</span></li>`;
                }
            }
            list += `</ul>`;

            return list;
        };
    }

    displayCert(set_name, cert_storage)
    {
        return this.buildPage(`${set_name} Certificate Content`,
                              async (context) => {
                                  const cert_name = context.params.file;
                                  const cert_path = path.join(cert_storage.storage_dir, cert_name);

                                  let cert_text = await OpenSsl.getText(cert_path);
                                  if (cert_text)
                                  {
                                      cert_text = `<pre>${cert_text}</pre>`;
                                  }
                                  else
                                  {
                                      cert_text = `<strong>Error reading the certificate file.</strong>`;
                                  }

                                  return cert_text;
                              });
    }
};
