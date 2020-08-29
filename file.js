const fs = require("fs").promises;


module.exports = {
    /*!
     * @brief Read the contents of a file directly.
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

    /*!
     * @brief Write contents directly to a file.
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
