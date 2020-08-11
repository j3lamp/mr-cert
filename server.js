const path = require("path");

const bodyParser = require("koa-bodyparser");
const Koa        = require("koa");
const Router     = require("koa-router");
const send       = require("koa-send");

const CountryCodes = require("./countryCodes");


function isFunction(object) {
    return typeof(object) == 'function';
}


function addIcon(content, icon=null)
{
    if (icon)
    {
        return `<i class="fas fa-sm fa-${icon}"></i> ${content}`;
    }
    else
    {
        return content;
    }
}

function link(url_base, file_name, link_name, icon=null)
{
    link_name = addIcon(link_name, icon);
    return `<a href="${url_base}/${file_name}">${link_name}</a>`;
}

function downloadLink(url_base, file_name, link_name, icon=null)
{
    link_name = addIcon(link_name, icon);
    return `<a href="${url_base}/${file_name}" download="${file_name}">${link_name}</a>`;
}

//! @todo add an icon parameter
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
        client_storage,
        open_ssl
    )
    {
        this.root_storage         = root_storage;
        this.intermediate_storage = intermediate_storage;
        this.client_storage       = client_storage;
        this.open_ssl             = open_ssl;


        this.http_server = new Koa();

        let router = new Router();

        // router.get("/", this.buildPage("",`<div class="empty"><i class="fas fa-certificate empty"></i></div>`));
        router.get("/", (context) => {
            context.body = (`<html><head><title>Mr. Cert</title>` +
                            `<link rel="stylesheet" type="text/css" href="/styles.css" />` +
                            `</head><body><script src="index.js"></script>` +
                            `</body></html>`);
        });
        router.get("/styles.css", async (context, next) => {
            await send(context, "styles.css", {root: path.join(__dirname, "styles")});
        });
        router.get("/index.js", async (context, next) => {
            await send(context, "index.js", {root: path.join(__dirname, "dist")});
        });
        router.get("/index.js.map", async (context, next) => {
            await send(context, "index.js.map", {root: path.join(__dirname, "dist")});
        });
        router.get("/fa/all.js", async (context, next) => {
            await send(context, "all.min.js", {root: __dirname});
        });

        router.get("/root",         this.buildPage("CA Roots",            this.listCerts(this.root_storage,         "/root")));
        router.get("/intermediate", this.buildPage("CA Intermediates",    this.listCerts(this.intermediate_storage, "/intermediate")));
        router.get("/client",       this.buildPage("Client Certificates",
                                                   [this.listCerts(this.client_storage, "/client"),
                                                    this.clientActions("/client")]));

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

        router.get("/client/create-cert", this.buildPage("Create Client Certificate",
                                                         this.createCertForm("/client",
                                                                             true,
                                                                             true)));

        router.post("/client/create-cert-file", this.createCert(this.client_storage,
                                                                "/client"));

        router.get("/api/root", async (context, next) => {
            context.body = await this.root_storage.getCerts();
        });

        this.http_server.use(bodyParser());
        this.http_server.use(router.routes())
                        .use(router.allowedMethods());
    }

    listen(port)
    {
        this.http_server.listen(port);
    }


    buildPage(title, content_functions)
    {
        let page_title = "Mr. Cert";
        if (title)
        {
            page_title = `${title} - ${page_title}`;
        }

        if (!Array.isArray(content_functions))
        {
            content_functions = [content_functions];
        }

        return async (context, next) =>
            {
                let page = `<html><head>`;
                page += `<link rel="stylesheet" type="text/css" href="/styles.css" />`;
                page += `<script defer="true" src="/fa/all.js"></script>`;
                page += `<title>${page_title}</title></head><body>`;
                page += `<header><h1>Mr. Cert</h1>`;
                if (title)
                {
                    page += `<h2>${title}</h2>`;
                }
                page += `</header>`;
                page += `<nav><ul>`;
                page += `<li><a href="/root">CA Roots</a></li>`;
                page += `<li><a href="/intermediate">CA Intermediates</a></li>`;
                page += `<li><a href="/client">Client Certificates</a></li>`;
                page += `</ul></nav>`;
                page += `<div class="content">`

                for (let content_function of content_functions)
                {
                    if (isFunction(content_function))
                    {
                        page += await content_function(context);
                    }
                    else if (content_function)
                    {
                        page += content_function;
                    }
                }

                page += `</div>`;
                page += `<footer>The preferred certificate authority of Dark Helmet</footer>`;
                page += `</body></html>`;

                context.body = page;
            };
    }

    listCerts(cert_storage, url_base)
    {
        const text_url_base = url_base + "/text";
        const file_url_base = url_base + "/files";

        return async () => {
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
                        list += ` ` + link(text_url_base, properties.certificate, "View", "eye");
                        list += ` ` + downloadLink(file_url_base, properties.certificate, "Certificate", "certificate");
                    }
                    if (properties.key)
                    {
                        list += ` ` + downloadLink(file_url_base, properties.key, "Key", "key");
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

                                  let cert_text = await this.open_ssl.getText(cert_path);
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

    clientActions(base_url)
    {
        let actions = `<nav><ul>`;
        actions += `<li>${link(base_url, "create-cert", "Create Certificate", "plus")}</li>`;
        actions += `</ul></nav>`;

        return actions;
    }

    createCertForm(base_url, sign_with_root, sign_with_intermediate)
    {
        return async() => {
            let form = `<form method="POST" action="${base_url}/create-cert-file"><ul>`;
            form += `<li><span class="field_name">Name</span><input type="text" name="name" /></li>`;
            if (sign_with_root || sign_with_intermediate)
            {
                form += `<li><span class="field_name">Signing Certificate Authority</span>`;
                form += `<select name="signing_cert">`;
                if (sign_with_root)
                {
                    const certs = await this.root_storage.getCerts();
                    if (Object.keys(certs).length > 0)
                    {
                        form += `<optgroup label="Root Certificates">`
                        for (const cert_name in certs)
                        {
                            if (certs.hasOwnProperty(cert_name))
                            {
                                const value =
                                      encodeURIComponent(JSON.stringify(
                                          {type: "root",
                                           name: cert_name}));
                                form += `<option value="${value}">${cert_name}</option>`;
                            }
                        }
                        form += `</optgroup>`
                    }
                }
                form += `</select></li>`;
            }
            {
                form += `<li><span class="field_name">Key Length <span class="unit">bits</span></span><select name="digest_length">`;
                form += `<option value="1024">1024</option>`;
                form += `<option value="2048">2048</option>`;
                form += `<option value="4096">4096</option>`;
                form += `</select></li>`;
            }
            {
                form += `<li><span class="field_name">Digest Algorithm</span><select name="digest_algorithm">`;
                form += `<option value="sha1">sha1</option>`;
                form += `<option value="sha224">sha224</option>`;
                form += `<option value="sha256" selected>sha256</option>`;
                form += `<option value="sha384">sha384</option>`;
                form += `<option value="sha512">sha512</option>`;
                form += `</select></li>`;
            }
            {
                form += `<li><span class="field_name">Lifetime <span class="unit">days</span></span><input type="number" name="lifetime" value="825" />`
                form += `<div class="note">Browsers will reject certificates with lifespans longer than 825 days.</div></li>`;
            }
            {
                form += `<li><span class="field_name">Country</span><select name="country">`;
                for (let code in CountryCodes)
                {
                    const country_name = CountryCodes[code];
                    const selected     = "US" == code ? " selected" : "";
                    form += `<option value="${code}"${selected}>${country_name}</option>`;
                }
                form += `</select></li>`;
            }
            form += `<li><span class="field_name">State</span><input type="text" name="state" /></li>`;
            form += `<li><span class="field_name">Locality</span><input type="text" name="locality" /></li>`;
            form += `<li><span class="field_name">Oranization</span><input type="text" name="organization" /></li>`;
            form += `<li><span class="field_name optional">Oranizational Unit</span><input type="text" name="organizational_unit" /></li>`;
            form += `<li><span class="field_name">E-Mail Address</span><input type="text" name="email_address" /></li>`;
            form += `<li><span class="field_name">Common Name</span><input type="text" name="common_name" /></li>`;
            form += `<li><span class="field_name optional">Subject Alternate Domain Names</span><input type="text" name="alternate_domain_names" /></li>`;
            form += `</ul>`
            form += `<input type="submit" value="Create Certificate" />`;
            form += `</form>`;

            return form;
        }
    }

    createCert(storage, url_base)
    {
        return async (context, next) => {
            const parameters   = context.request.body;
            const domain_names = parameters.alternate_domain_names.split(/[^-.a-zA-Z0-9]+/);

            const cert_params = JSON.parse(decodeURIComponent(parameters.signing_cert));
            let   cert        = null;
            if ("root" == cert_params.type)
            {
                cert = await this.root_storage.getCert(cert_params.name);
                cert.certificate = path.join(this.root_storage.storage_dir,
                                             cert.certificate);
                cert.key         = path.join(this.root_storage.storage_dir,
                                             cert.key);
            }
            else if ("intermediate" == cert_params.type)
            {
                //! @todo implement this
            }
            else
            {
                AppError.weShouldNeverGetHere();
            }

            if (!cert)
            {
                //! @todo error!
                return;
            }

            const name = await this.open_ssl.makeClientCert(parameters.name,
                                                            cert.certificate,
                                                            cert.key,
                                                            parameters.digest_length,
                                                            parameters.digest_algorithm,
                                                            parameters.lifetime,
                                                            parameters.country,
                                                            parameters.state,
                                                            parameters.locality,
                                                            parameters.organization,
                                                            parameters.organizational_unit,
                                                            parameters.email_address,
                                                            parameters.common_name,
                                                            domain_names,
                                                            storage);
            if (name)
            {
                context.response.redirect(`${url_base}/text/${name}`);
            }
            else
            {
                context.status = 500;
            }
        };
    }
};
