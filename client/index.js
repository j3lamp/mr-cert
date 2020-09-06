"use strict"

import m from "mithril";

const CountryCodes = require("../common/countryCodes");

import * as CertTypes       from "./certTypes"
import Form                 from "./form"
import Icons                from "./icons"
import {link, downloadLink} from "./link"
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

    loadedContent(vnode)
    {
        const cert_type = vnode.attrs.type;
        const text_route_base = `/${cert_type}/text`;
        const file_url_base   = `/files/${cert_type}`;

        let certs = [];
        for (const cert_name in this.certificates)
        {
            if (state.certificates.hasOwnProperty(cert_name))
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

                let key  = null;
                if (properties.has_key)
                {
                    key = [" ", downloadLink(file_url_base,
                                             `${cert_name}.key`,
                                             "Key",
                                             "key")];
                }

                certs.push(m("li", [cert_name,
                                    m("span", {class: "files"}, [cert, key])]));
            }
        }

        let controls = null;
        if (this.can_create)
        {
            controls = m("nav", m("ul", m("li", link(`/${cert_type}`,
                                                     "create-cert",
                                                     "Create Cert",
                                                     "plus"))));
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


class CreateCert extends LoadingPage
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
            for (const type in this.signing_certs)
            {
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
        this.form.addSelect("country", "Country", "US", COUNTRY_OPTIONS);
        this.form.addInput("state",               "State");
        this.form.addInput("locality",            "Locality");
        this.form.addInput("organization",        "Organization");
        this.form.addInput("organizational_unit", "Organizational Unit");
        this.form.addInput("email_address",       "E-Mail Address");
        this.form.addInput("common_name",         "Common Name");
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

        this.form.setSubmit("Create Certificate",
                            () => { return this.submit(cert_type); });
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
            "/:type/create-cert":        CreateCert
        });
