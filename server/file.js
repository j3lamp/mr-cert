const fs = require("fs").promises;

/**
 * @module File
 */

module.exports = {
    /**
     * Read the contents of a file directly.
     *
     * @param {string} file_path  The path, on disk, to the file to be read.
     * @param {string} encoding   The encoding to use when reading the file.
     *
     * @returns {string|Buffer}
     *     The contents of the file as a string if appropriate for the
     *     `encoding` used otherwise as a Buffer.
     */
    readFile: async function readFile(file_path, encoding="utf8")
    {
        let file = null;
        try
        {
            file = await fs.open(file_path, 'r')
            return await file.readFile({encoding: encoding});
        }
        catch (error)
        {
            console.log(error);
        }
        finally
        {
            if (file)
            {
                await file.close()
            }
        }
    },

    /**
     * Write contents directly to a file.
     *
     * @param {string}        file_path  The path, on disk, to the file to be
     *                                   written.
     * @param {string|Buffer} contents   The data to be written to the file.
     */
    writeFile: async function writeFile(file_path, contents)
    {
        let file = null;
        try
        {
            file = await fs.open(file_path, 'w')
            await file.writeFile(contents);
        }
        catch (error)
        {
            console.error(error);
        }
        finally
        {
            if (file)
            {
                await file.close()
            }
        }
    }
};
