"use strict"

import m from "mithril";

const Config       = require("../common/openSslConfig");
const CountryCodes = require("../common/countryCodes");

import * as CertTypes       from "./certTypes"
import Form                 from "./form"
import Icons                from "./icons"
import {link, downloadLink} from "./link"
import OpenSsl              from "./openSsl"
import {Page, LoadingPage}  from "./page"


let dom_root = document.body;


class Blank extends Page
{
    content()
    {
        return m("div", {class: "empty"}, Icons.certificate());
    }
};


class CertList extends LoadingPage
{
    request(vnode)
    {
        this.certificates = {};
        this.can_create   = false;

        let requests = [m.request({method: "GET",
                                   url:    `/api/${vnode.attrs.type}`})
                        .then((data) => {
                            this.certificates = data;
                        })];

        const signing_types = CertTypes.getSigningTypes(vnode.attrs.type);
        if (signing_types.length > 0)
        {
            const encoded_types = encodeURIComponent(JSON.stringify(signing_types));
            requests.push(m.request({method: "GET",
                                     url:    `/api/have_certs?types=${encoded_types}`})
                          .then((data) => {
                              this.can_create = data.have_certs;
                          }));
        }
        else
        {
            this.can_create = true;
        }

        return requests;
    }

    subtitle(vnode)
    {
        const type_name = CertTypes.getCertTypeName(vnode.attrs.type);
        return `${type_name}s`;
    }

    loadedContent(vnode)
    {
        const cert_type = vnode.attrs.type;
        const text_route_base = `/${cert_type}/text`;
        const file_url_base   = `/files/${cert_type}`;

        let certs = [];
        for (const cert_name in this.certificates)
        {
            if (this.certificates.hasOwnProperty(cert_name))
            {
                const properties = this.certificates[cert_name];

                const cert_file = `${cert_name}.crt`;
                const cert = [" ", link(text_route_base,
                                        cert_file,
                                        "View",
                                        "eye"),
                              " ", downloadLink(file_url_base,
                                                cert_file,
                                                "Certificate",
                                                "certificate")];

                let chain = null;
                if (properties.has_chain)
                {
                    chain = [" ", downloadLink(file_url_base,
                                               `${cert_name}.chain.crt`,
                                               "Chain",
                                               "link")]
                }

                let key  = null;
                if (properties.has_key)
                {
                    key = [" ", downloadLink(file_url_base,
                                             `${cert_name}.key`,
                                             "Key",
                                             "key")];
                }

                certs.push(m("li", [cert_name,
                                    m("span", {class: "files"}, [cert, chain, key])]));
            }
        }

        let controls = null;
        if (this.can_create)
        {
            let csr_controls = [];
            if (!CertTypes.isSigningType(cert_type))
            {
                csr_controls = [
                    m("li", link(`/${cert_type}`, "create-csr", "Create CSR", "plusSquare")),
                    m("li", link(`/${cert_type}`, "sign-csr",   "Sign CSR",   "fileSignature"))
                ];
            }

            controls = m("nav", m("ul", [
                ...csr_controls,
                m("li", link(`/${cert_type}`, "create-cert", "Create Cert", "plus")),
                m("li", link(`/${cert_type}`, "upload-cert", "Upload",      "fileUpload"))
            ]));
        }

        return m("ul", {class: "cert-list"}, [certs, controls]);
    }
};

class CertText extends LoadingPage
{
    request(vnode)
    {
        const {type, certificate} = vnode.attrs;

        this.certificate_text = null;

        return (m.request({method:       "GET",
                           url:          `api/${type}/text/${certificate}`,
                           responseType: "text"})
                .then((data) => {
                    this.certificate_text = data;
                }));
    }

    subtitle(vnode)
    {
        const {type, certificate} = vnode.attrs;
        const type_name = CertTypes.getCertTypeName(type);

        return `${certificate} (${type_name})`;
    }

    loadedContent(vnode)
    {
        if (this.certificate_text)
        {
            return m("pre", this.certificate_text);
        }
        else
        {
            return m("strong", "Error reading the certificate file.");
        }
    }
};

const KEY_LENGTH_OPTIONS = [2048, 4096, 8192];
const DIGEST_ALGORITHM_OPTIONS = ["sha256", "sha384", "sha512"];
const COUNTRY_OPTIONS = (() => {
    let options = [];
    for (const code in CountryCodes)
    {
        options.push({value: code, name: CountryCodes[code]});
    }
    return options;
})();
const DEFAULT_LIFESPAN = {root:         (365 * 20 + 20 / 4),
                          intermediate: (365 * 5 + 1),
                          server:       825,
                          client:       375}


class CreateCertForm extends LoadingPage
{
    request(vnode)
    {
        const cert_type = vnode.attrs.type;

        this.signing_certs = null;

        const signing_types = CertTypes.getSigningTypes(cert_type);
        let requests = [];
        if (signing_types.length > 0)
        {
            this.signing_certs = {};
            requests = signing_types.map((type) => {
                return (m.request({method: "GET",
                                   url:    `/api/${type}`})
                        .then((data) => {
                            this.signing_certs[type] = data;
                        }));
            });
        }

        return (Promise.all(requests)
                .then(() => {
                    this.createForm(cert_type);
                }));
    }

    createForm(cert_type)
    {
        let signing_options = null;
        if (null !== this.signing_certs)
        {
            signing_options = [];
            // for (const type in this.signing_certs)
            for (const {type} of CertTypes.SIGNING_CERT_TYPES)
            {
                if (!this.signing_certs[type])
                {
                    continue;
                }

                let ca_options = [];
                for (const cert_name in this.signing_certs[type])
                {
                    const value = JSON.stringify({type: type,
                                                  name: cert_name});
                    ca_options.push({value: value,
                                     name:  cert_name});
                }

                signing_options.push({group:   CertTypes.getCertTypeName(type),
                                      options: ca_options});
            }
        }

        let default_key_length = 2048;
        if (CertTypes.isSigningType(cert_type))
        {
            default_key_length = 4096;
        }

        let lifetime_note = null;
        if ("server" == cert_type)
        {
            lifetime_note = () => {
                return m("div",
                         {class: "note"},
                         ("Browsers will reject certificates with lifespans " +
                          "longer than 825 days."));
            };
        }

        this.form = new Form(`${cert_type}_cert_form`);

        this.form.addInput("name", "Name");
        if (null !== signing_options)
        {
            this.form.addSelect("signer", "Signing Certificate", "", signing_options);
        }
        this.form.addSelect("key_length",
                            ["Key Length ", m("span", {class: "unit"}, "bits")],
                            default_key_length,
                            KEY_LENGTH_OPTIONS);
        this.form.addSelect("digest", "Digest", "sha256", DIGEST_ALGORITHM_OPTIONS);
        this.form.addInput("lifetime",
                           ["Lifetime", m("span", {class: "unit"}, "days")],
                           DEFAULT_LIFESPAN[cert_type],
                           "number",
                           lifetime_note);
        this.form.addInput("common_name",         "Common Name");
        this.form.addSelect("country", "Country", "US", COUNTRY_OPTIONS);
        this.form.addInput("state",               "State");
        this.form.addInput("locality",            "Locality");
        this.form.addInput("organization",        "Organization");
        this.form.addInput("organizational_unit", "Organizational Unit");
        this.form.addInput("email_address",       "E-Mail Address");
        if ("root" == cert_type)
        {
            this.form.addCheckbox("intermediate_only",
                                  "Only use to sign intermediate certificates",
                                  false);
        }
        else if ("server" == cert_type)
        {
            this.form.addInput("domain_names",
                               "Subject Alternate Domain Names",
                               [],
                               "list");
        }

        this.form.setSubmit(this.getSubmitText(),
                            () => { return this.submit(cert_type); });
    }

    /**
     * Get the name to display on the submit button.
     *
     * @param {string} cert_type  The certificate type string, e.g. "root".
     *
     * @return {string}
     *     The name to display on the submit button.
     *
     * @virtual
     */
    getSubmitText(cert_type)
    {
        return "";
    }

    /**
     * Submit the form.
     *
     * @param {string} cert_type  The certificate type string, e.g. "root".
     *
     * @virtual
     */
    submit(cert_type)
    {
        console.error("submmit() needs to be overridden");
    }

    loadedContent()
    {
        return this.form.m();
    }
};


class CreateCert extends CreateCertForm
{
    subtitle(vnode)
    {
        const type_name = CertTypes.getCertTypeName(vnode.attrs.type);
        return `Create a ${type_name}`;
    }

    getSubmitText(cert_type)
    {
        return "Create Certificate";
    }

    submit(cert_type)
    {
        try
        {
            let body = this.form.getValues();
            if (undefined !== body.signer)
            {
                body.signer = JSON.parse(body.signer);
            }
            body.key_length = parseInt(body.key_length, 10);

            if (!isNaN(body.key_length))
            {
                this.whileLoading(
                    m.request({method: "POST",
                               url:    `/${cert_type}/create-cert-file`,
                               body:   body})
                        .then((data) => {
                            m.route.set(`/${cert_type}/text/${data.new_cert}`);
                        })
                        .catch(() => {
                            /// @todo display an error, ideally something useful...

                            // However, we don't want the standard error page
                            // since in most cases the user will be able to fix
                            // the error.
                        })
                );
            }
        }
        finally
        {
            return false;
        }
    }
};

class CreateCsr extends CreateCertForm
{
    subtitle(vnode)
    {
        const type_name = CertTypes.getCertTypeName(vnode.attrs.type);
        return `Create a ${type_name} Signing Request`;
    }

    getSubmitText(cert_type)
    {
        return "Create CSR";
    }

    loadedContent()
    {
        if (this.common_name &&
            this.key_length  &&
            this.csr_config)
        {
            const config_file_name = `${this.common_name}.conf`;
            const key_file_name    = `${this.common_name}.key`;
            const csr_file_name    = `${this.common_name}.csr`;

            return [m("p", [
                        "Create the certificate signing request with the following command:",
                        m("pre", OpenSsl.createCsr(config_file_name,
                                                   this.key_length,
                                                   key_file_name,
                                                   csr_file_name))
                    ]),
                    m("h1", "CSR Configuration File"),
                    m("a",
                      {href:     `data:text/plain,${encodeURIComponent(this.csr_config)}`,
                       download: config_file_name},
                      Icons.addTo("Download", "fileDownload")),
                    m("pre", this.csr_config)];
        }
        else
        {
            return super.loadedContent();
        }
    }

    submit(cert_type)
    {
        let values = this.form.getValues();
        console.dir(values);

        values.key_length = parseInt(values.key_length, 10);

        if (!isNaN(values.key_length))
        {
            this.common_name = values.common_name;
            this.key_length  = values.key_length;
            this.csr_config  = Config.getCertificateSigningRequest(values.digest,
                                                                   values.common_name,
                                                                   values.country,
                                                                   values.state,
                                                                   values.locality,
                                                                   values.organization,
                                                                   values.organizational_unit,
                                                                   values.email_address,
                                                                   false,
                                                                   values.domain_names);
        }

        return false;
    }
};


class UploadCert extends LoadingPage
{
    request(vnode)
    {
        const cert_type = vnode.attrs.type;

        this.signing_certs = null;

        const signing_types = CertTypes.getSigningTypes(cert_type);
        let requests = [];
        if (signing_types.length > 0)
        {
            this.signing_certs = {};
            requests = signing_types.map((type) => {
                return (m.request({method: "GET",
                                   url:    `/api/${type}`})
                        .then((data) => {
                            this.signing_certs[type] = data;
                        }));
            });
        }

        return (Promise.all(requests)
                .then(() => {
                    this.createForm(cert_type);
                }));
    }

    createForm(cert_type)
    {
        let signing_options = null;
        if (null !== this.signing_certs)
        {
            signing_options = [];
            // for (const type in this.signing_certs)
            for (const {type} of CertTypes.SIGNING_CERT_TYPES)
            {
                if (!this.signing_certs[type])
                {
                    continue;
                }

                let ca_options = [];
                for (const cert_name in this.signing_certs[type])
                {
                    const value = JSON.stringify({type: type,
                                                  name: cert_name});
                    ca_options.push({value: value,
                                     name:  cert_name});
                }

                signing_options.push({group:   CertTypes.getCertTypeName(type),
                                      options: ca_options});
            }
        }


        this.form = new Form("upload_form");

        this.form.addInput("name", "Name");
        if (null !== signing_options)
        {
            this.form.addSelect("signer", "Signing Certificate", "", signing_options);
        }
        this.form.addTextFile("cert_file", "Certificate File");
        this.form.addTextFile("key_file",  "Private Key");
        if ("root" == cert_type)
        {
            this.form.addCheckbox("intermediate_only",
                                  "Only use to sign intermediate certificates",
                                  false);
        }

        this.form.setSubmit("Upload Certificate",
                            () => { return this.submit(cert_type) })
    }

    submit(cert_type)
    {
        try
        {
            let body = this.form.getValues();
            if (undefined !== body.signer)
            {
                body.signer = JSON.parse(body.signer);
            }
            if (body.cert_file)
            {
                body.cert_file = body.cert_file.text;
            }
            if (body.key_file)
            {
                body.key_file  = body.key_file.text;
            }

            this.whileLoading(
                m.request({method: "POST",
                           url:    `/${cert_type}/upload-cert-file`,
                           body:   body})
                    .then((data) => {
                        m.route.set(`/${cert_type}/text/${data.new_cert}`);
                    })
                    .catch(() => {
                        /// @todo display an error, ideally something useful...

                        // However, we don't want the standard error page
                        // since in most cases the user will be able to fix
                        // the error.
                    })
            );
        }
        finally
        {
            return false;
        }
    }

    subtitle(vnode)
    {
        const type_name = CertTypes.getCertTypeName(vnode.attrs.type);
        return `Upload a ${type_name}`;
    }

    loadedContent()
    {
        return this.form.m();
    }
};


m.route(dom_root,
        "/",
        {
            "/":                         Blank,
            "/:type":                    CertList,
            "/:type/text/:certificate":  CertText,
            "/:type/create-csr":         CreateCsr,
            "/:type/create-cert":        CreateCert,
            "/:type/upload-cert":        UploadCert
        });
