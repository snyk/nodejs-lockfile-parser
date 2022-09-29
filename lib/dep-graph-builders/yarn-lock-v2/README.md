**NOTE**

In yarn v2 the old lockfile (lockfile v1) format was scrapped entirely. The new format is yaml-like (though not perfect yaml).

Moreover this new version is more incrementally versioned and the version of the lockfile is in the `__metadata` entry in the lockfile itself. Therefore the naming of this module `yarn-lock-v2` is not the full picture. We actually support yarn-lock version 2 -> version 8 at time of writing - likely more as they come out as the changes arent usually breaking. Yarn itself also uses this "not version 1" rule so should work for us for now[^1].

Of interest:

- Commit where this was introduced [link](https://github.com/yarnpkg/berry/commit/2f9e8073d15745f9d53e6b8b42fa9c81eb143d54)

[^1]: https://github.com/yarnpkg/berry/blob/9007a915955edd8bf4500c6989dc52e12012cf40/packages/yarnpkg-core/sources/Project.ts#L312
