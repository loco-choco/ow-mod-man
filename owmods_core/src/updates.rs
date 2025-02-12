use anyhow::Result;
use log::info;
use version_compare::Cmp;

use crate::{
    analytics::{send_analytics_event, AnalyticsEventName},
    config::Config,
    constants::OWML_UNIQUE_NAME,
    db::{LocalDatabase, RemoteDatabase},
    download::{download_and_install_owml, install_mods_parallel},
    mods::{local::LocalMod, remote::RemoteMod},
};

/// Check a given local mod against the remote database to see if there's an update.
/// Skips if the mod doesn't have a remote counterpart or if the versions can't be parsed.
///
/// ## Returns
///
/// A tuple containing:
/// - If an update is available
/// - An option with the remote mod with the newer version, if the first item is `false` this will be `None`.
///
pub fn check_mod_needs_update<'a>(
    local_mod: &'a LocalMod,
    remote_db: &'a RemoteDatabase,
) -> (bool, Option<&'a RemoteMod>) {
    let remote_mod = if local_mod.manifest.unique_name == OWML_UNIQUE_NAME {
        remote_db.get_owml()
    } else {
        remote_db.get_mod(&local_mod.manifest.unique_name)
    };
    if let Some(remote_mod) = remote_mod {
        (
            version_compare::compare(&remote_mod.version, &local_mod.manifest.version)
                .map(|o| o == Cmp::Gt)
                .unwrap_or_else(|_| local_mod.manifest.version != remote_mod.version),
            Some(remote_mod),
        )
    } else {
        (false, None)
    }
}

/// Check all mods *and OWML* for updates and update them if needed.
///
/// ## Returns
///
/// Whether any updates were actually performed
///
/// ## Errors
///
/// If we can't read or update the mods.
///
pub async fn update_all(
    config: &Config,
    local_db: &LocalDatabase,
    remote_db: &RemoteDatabase,
    dry: bool,
) -> Result<bool> {
    let mut needs_update: Vec<&RemoteMod> = vec![];

    for local_mod in local_db.valid() {
        let (update, remote_mod) = check_mod_needs_update(local_mod, remote_db);
        if update {
            info!(
                "{}: {} -> {}",
                local_mod.manifest.name,
                local_mod.manifest.version,
                remote_mod.unwrap().version
            );
            needs_update.push(remote_mod.unwrap());
        }
    }

    let owml = LocalDatabase::get_owml(&config.owml_path);

    let mut owml_updated = false;

    if owml.is_some() {
        let (update, remote_owml) = check_mod_needs_update(owml.as_ref().unwrap(), remote_db);
        if update {
            owml_updated = true;
            info!(
                "OWML: {} -> {}",
                owml.as_ref().unwrap().manifest.version,
                remote_owml.unwrap().version
            );
            download_and_install_owml(config, remote_owml.unwrap(), false).await?;
        }
    }

    if needs_update.is_empty() {
        Ok(owml_updated)
    } else {
        if !dry {
            let mod_names = needs_update
                .into_iter()
                .map(|m| m.unique_name.clone())
                .collect();
            let updated = install_mods_parallel(mod_names, config, remote_db, local_db).await?;
            for updated_mod in updated {
                send_analytics_event(
                    AnalyticsEventName::ModUpdate,
                    &updated_mod.manifest.unique_name,
                )
                .await;
            }
        }
        Ok(true)
    }
}

#[cfg(test)]
mod tests {

    use super::*;

    fn setup(local_version: &str, remote_version: &str) -> (LocalMod, RemoteDatabase) {
        let mut new_mod = LocalMod::get_test(0);
        new_mod.manifest.version = local_version.to_string();
        let mut new_remote_mod = RemoteMod::get_test(0);
        new_remote_mod.version = remote_version.to_string();
        let mut db = RemoteDatabase::default();
        db.mods
            .insert(new_remote_mod.unique_name.to_string(), new_remote_mod);
        (new_mod, db)
    }

    #[test]
    fn test_check_mod_needs_update() {
        let (new_mod, db) = setup("0.1.0", "0.2.0");
        let (needs_update, remote) = check_mod_needs_update(&new_mod, &db);
        assert!(needs_update);
        assert_eq!(remote.unwrap().version, "0.2.0");
    }

    #[test]
    fn test_check_mod_needs_update_none() {
        let (new_mod, db) = setup("0.2.0", "0.2.0");
        let (needs_update, _) = check_mod_needs_update(&new_mod, &db);
        assert!(!needs_update);
    }

    #[test]
    fn test_check_mod_needs_update_invalid_versions() {
        let (new_mod, db) = setup("burger", "burger");
        let (needs_update, _) = check_mod_needs_update(&new_mod, &db);
        assert!(!needs_update);
    }

    #[test]
    fn test_check_needs_update_invalid_mismatched_versions() {
        let (new_mod, db) = setup("burger", "burger2.0");
        let (needs_update, _) = check_mod_needs_update(&new_mod, &db);
        assert!(needs_update);
    }
}
