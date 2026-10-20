# Private CI artifact configuration

The Contabo S3 uploader is pinned to woodpeckerci/plugin-s3 manifest bf0a088e66b991803e3b9b0401f616245c4d736674195204a7e9e343a871a9ea.
Its actual --help declares --acl / PLUGIN_ACL; use acl:private. The previous access field was ignored, while the plugin default already kept objects private.
All four ci_artifact_* repository secrets explicitly enable pull_request, push, tag, manual, cron, deployment and pull_request_metadata; these event/image policies were read back on Contabo. Credentials remain restricted to reviewed S3 plugin images and a separate private repository bucket.
Application code, lockfiles, gate commands, artifact paths and retention are unchanged. Rollback is reverting this configuration-only follow-up.
