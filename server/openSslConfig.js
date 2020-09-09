"use strict"

const Enum = require("es6-enum");

/**
 * @module OpenSslConfig
 *
 * @description
 * Utilities for generating configuration files for use with the `openssl`
 * command.
 *
 * @see <https://jamielinux.com/docs/openssl-certificate-authority/index.html>
 * @see <https://jamielinux.com/docs/openssl-certificate-authority/appendix/root-configuration-file.html>
 * @see <https://jamielinux.com/docs/openssl-certificate-authority/appendix/intermediate-configuration-file.html>
 */


const SignedType = Enum("SERVER");


module.exports = {
    getCertificateSigningRequest: function getCertificateSigningRequest(
        digest_algorithm,
        common_name,
        country,
        state,
        locality,
        organization,
        organizational_unit,
        email_address,
        is_root_ca=false,
        alternate_domain_names=[]
    )
    {
        const have_alternate_domains = (alternate_domain_names &&
                                        alternate_domain_names.length > 0)
        const have_req_extensions    = have_alternate_domains;
        const have_x509_extensions   = is_root_ca;

        let config = [
            "[req]",
            "prompt                 = no",
            "encrypt_key            = no",
            `default_md             = ${digest_algorithm}`,
            "distinguished_name     = dn"];
        if (have_req_extensions)
        {
            config.push("req_extensions         = req_ext");
        }
        if (have_x509_extensions)
        {
            config.push("x509_extensions        = x509_ext");
        }

        config.push(
            "",
            "[ dn ]",
            `CN                     = ${common_name}`,
            `O                      = ${organization}`);
        if (organizational_unit)
        {
            config.push(`OU                     = ${organizational_unit}`);
        }
        config.push(
            `C                      = ${country}`,
            `ST                     = ${state}`,
            `L                      = ${locality}`);
        if (email_address)
        {
            config.push(`emailAddress           = ${email_address}`);
        }

        if (have_req_extensions)
        {
            config.push(
                "",
                "[ req_ext ]");
            if (have_alternate_domains)
            {
                const domain_entries = alternate_domain_names.map((name) => {
                    return `DNS: ${name}`;
                });
                const domain_list = domain_entries.join(", ");

                config.push(`subjectAltName         = ${domain_list}`);
            }
        }

        if (have_x509_extensions)
        {
            config.push(
                "",
                "[ x509_ext ]");
            if (is_root_ca)
            {
                config.push(
                    "subjectKeyIdentifier   = hash",
                    "authorityKeyIdentifier = keyid:always,issuer",
                    "basicConstraints       = critical, CA:true",
                    "keyUsage               = critical, digitalSignature, cRLSign, keyCertSign");
            }
        }

        return config.join("\n");
    },

    getStrictCaConfig: function getStrictCaConfig(index_path,
                                                  serial_path,
                                                  rand_path,
                                                  key_path,
                                                  certificate_path,
                                                  new_certs_dir)
    {
        let config = [
            "[ca]",
            "default_ca             = CA_default",
            "",
            "[ CA_default ]",
            `new_certs_dir          = ${new_certs_dir}`,
            `database               = ${index_path}`,
            `serial                 = ${serial_path}`,
            `RANDFILE               = ${rand_path}`,
            "",
            `private_key            = ${key_path}`,
            `certificate            = ${certificate_path}`,
            "",
            "preserve               = no",
            "policy                 = policy_strict",
            "",
            "x509_extensions        = v3_ca",
            "",
            "[ policy_strict ]",
            "commonName             = supplied",
            "organizationName       = match",
            "organizationalUnitName = optional",
            "countryName            = match",
            "stateOrProvinceName    = match",
            "localityName           = match",
            "emailAddress           = optional",
            "",
            "[ v3_intermediate_ca ]",
            "subjectKeyIdentifier   = hash",
            "authorityKeyIdentifier = keyid:always,issuer",
            "basicConstraints       = critical, CA:true, pathlen:0",
            "keyUsage               = critical, digitalSignature, cRLSign, keyCertSign"];

        return config.join("\n");
    },

    SignedType: SignedType,

    getLooseCaConfig: function getLooseCaConfig(index_path,
                                                serial_path,
                                                rand_path,
                                                key_path,
                                                certificate_path,
                                                new_certs_dir,
                                                digest_algorithm,
                                                lifetime,
                                                signed_type)
    {
        let config = [
            "[ca]",
            "default_ca             = CA_default",
            "",
            "[ CA_default ]",
            `new_certs_dir          = ${new_certs_dir}`,
            `database               = ${index_path}`,
            `serial                 = ${serial_path}`,
            `RANDFILE               = ${rand_path}`,
            "",
            `private_key            = ${key_path}`,
            `certificate            = ${certificate_path}`,
            "",
            "preserve               = no",
            "policy                 = policy_loose",
            "",
            `default_md             = ${digest_algorithm}`,
            `default_days           = ${lifetime}`,
            "",
            "x509_extensions        = x509_ext",
            "copy_extensions        = copy",
            "",
            "[ policy_loose ]",
            "# Allow the intermediate CA to sign a more diverse range of certificates.",
            "# See the POLICY FORMAT section of the ca man page.",
            "countryName            = optional",
            "stateOrProvinceName    = optional",
            "localityName           = optional",
            "organizationName       = optional",
            "organizationalUnitName = optional",
            "commonName             = supplied",
            "emailAddress           = optional",
            "",
            "[ x509_ext ]"];
        if (SignedType.SERVER       == signed_type)
        {
            config.push(
                "basicConstraints       = CA:FALSE",
                "nsCertType             = server",
                `nsComment              = "OpenSSL Generated Server Certificate"`,
                "subjectKeyIdentifier   = hash",
                "authorityKeyIdentifier = keyid,issuer:always",
                "keyUsage               = critical, digitalSignature, keyEncipherment",
                "extendedKeyUsage       = serverAuth");
        }

        return config.join("\n");
    }
};
