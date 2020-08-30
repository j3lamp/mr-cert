"use strict"

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

const COMMON_CONFIG = `[ policy_strict ]
# The root CA should only sign intermediate certificates that match.
# See the POLICY FORMAT section of man ca.
countryName             = match
stateOrProvinceName     = match
organizationName        = match
organizationalUnitName  = optional
commonName              = supplied
emailAddress            = optional

[ policy_loose ]
# Allow the intermediate CA to sign a more diverse range of certificates.
# See the POLICY FORMAT section of the ca man page.
countryName             = optional
stateOrProvinceName     = optional
localityName            = optional
organizationName        = optional
organizationalUnitName  = optional
commonName              = supplied
emailAddress            = optional

[ req ]
# Options for the req tool (man req).
default_bits        = 2048
distinguished_name  = req_distinguished_name
string_mask         = utf8only

# SHA-1 is deprecated, so use SHA-2 instead.
default_md          = sha256

# Extension to add when the -x509 option is used.
x509_extensions     = v3_ca

[ req_distinguished_name ]
# See <https://en.wikipedia.org/wiki/Certificate_signing_request>.
countryName                     = Country Name (2 letter code)
stateOrProvinceName             = State or Province Name
localityName                    = Locality Name
0.organizationName              = Organization Name
organizationalUnitName          = Organizational Unit Name
commonName                      = Common Name
emailAddress                    = Email Address

[ v3_ca ]
# Extensions for a typical CA (man x509v3_config).
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always,issuer
basicConstraints = critical, CA:true
keyUsage = critical, digitalSignature, cRLSign, keyCertSign

[ v3_intermediate_ca ]
# Extensions for a typical intermediate CA (man x509v3_config).
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always,issuer
basicConstraints = critical, CA:true, pathlen:0
keyUsage = critical, digitalSignature, cRLSign, keyCertSign

[ usr_cert ]
# Extensions for client certificates (man x509v3_config).
basicConstraints = CA:FALSE
nsCertType = client, email
nsComment = "OpenSSL Generated Client Certificate"
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer
keyUsage = critical, nonRepudiation, digitalSignature, keyEncipherment
extendedKeyUsage = clientAuth, emailProtection

[ server_cert ]
# Extensions for server certificates (man x509v3_config).
basicConstraints = CA:FALSE
nsCertType = server
nsComment = "OpenSSL Generated Server Certificate"
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer:always
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth

[ crl_ext ]
# Extension for CRLs (man x509v3_config).
authorityKeyIdentifier=keyid:always

[ ocsp ]
# Extension for OCSP signing certificates (man ocsp).
basicConstraints = CA:FALSE
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer
keyUsage = critical, digitalSignature
extendedKeyUsage = critical, OCSPSigning`

module.exports = {
    getCreateCaConfig: function getCreateCaConfig(
        digest_algorithm,
        common_name,
        country,
        state,
        locality,
        organization,
        organizational_unit,
        email_address
    )
    {
        let config = [
            "[req]",
            "prompt = no",
            "encrypt_key = no",
            `default_md = ${digest_algorithm}`,
            "distinguished_name = dn",
            "",
            "[ dn ]",
            `CN = ${common_name}`,
            `O = ${organization}`];
        if (organizational_unit)
        {
            config.push(`OU = ${organizational_unit}`);
        }
        config.push(
            `C = ${country}`,
            `ST = ${state}`,
            `L = ${locality}`,
            `emailAddress = ${email_address}`,
            "",
            "[ v3_ca ]",
            "# Extensions for a typical CA (man x509v3_config).",
            "subjectKeyIdentifier = hash",
            "authorityKeyIdentifier = keyid:always,issuer",
            "basicConstraints = critical, CA:true",
            "keyUsage = critical, digitalSignature, cRLSign, keyCertSign");

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
    }
};
